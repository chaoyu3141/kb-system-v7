#!/usr/bin/env bash
# lib.sh — 部署功能函数库
# 依赖：config.sh（提供项目参数）
# 设计：所有函数集中于此，deploy.sh 仅做命令分发与流程编排

set -Eeuo pipefail
IFS=$'\n\t'

# ==============================
# 运行时状态
# ==============================
START_TIME=$(date +%s)
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE=""

OLD_COMMIT=""
NEW_COMMIT=""
CHANGED_FILES=""

# ==============================
# 日志与错误处理
# ==============================
info() {
  printf '\n\033[1;34m[信息]\033[0m %s\n' "$1"
}

success() {
  printf '\033[1;32m[成功]\033[0m %s\n' "$1"
}

warning() {
  printf '\033[1;33m[提醒]\033[0m %s\n' "$1"
}

fail() {
  printf '\033[1;31m[失败]\033[0m %s\n' "$1" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  local line_number=$1

  printf '\n\033[1;31m========================================\033[0m\n'
  printf '\033[1;31m部署失败：第 %s 行，退出码 %s\033[0m\n' "$line_number" "$exit_code"

  if [[ -n "${LOG_FILE:-}" ]]; then
    printf '\033[1;31m日志文件：%s\033[0m\n' "$LOG_FILE"
  fi

  printf '\033[1;31m========================================\033[0m\n'
  exit "$exit_code"
}

trap 'on_error $LINENO' ERR

# ==============================
# 环境与前置检查
# ==============================
require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 \
    || fail "缺少命令：${command_name}"
}

require_root_user() {
  if [[ "${REQUIRE_ROOT}" == "true" && "${EUID}" -ne 0 ]]; then
    fail "请使用 root 用户执行部署"
  fi
}

check_required_commands() {
  local commands=(git npm npx systemctl curl sqlite3 flock)
  local command_name
  for command_name in "${commands[@]}"; do
    require_command "$command_name"
  done
}

prepare_runtime() {
  mkdir -p "$DEPLOY_LOG_DIR" "$BACKUP_DIR"
  LOG_FILE="${DEPLOY_LOG_DIR}/deploy-${TIMESTAMP}.log"
  exec > >(tee -a "$LOG_FILE") 2>&1

  printf '\n========================================\n'
  printf ' %s 自动部署\n' "$APP_DISPLAY_NAME"
  printf ' 时间：%s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '========================================\n'
}

acquire_deploy_lock() {
  exec 9>"$DEPLOY_LOCK_FILE"
  flock -n 9 || fail "已有部署任务正在运行，请稍后再试"
}

require_app_directory() {
  [[ -d "$APP_DIR" ]] || fail "项目目录不存在：${APP_DIR}"
  cd "$APP_DIR"
}

require_clean_git_worktree() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || fail "当前目录不是 Git 仓库"

  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short
    fail "服务器存在未提交或未跟踪文件，部署已停止"
  fi
}

# ==============================
# Git 操作
# ==============================
check_git_branch() {
  local current_branch
  current_branch=$(git branch --show-current)
  [[ "$current_branch" == "$GIT_BRANCH" ]] \
    || fail "当前分支是 ${current_branch}，要求分支为 ${GIT_BRANCH}"
}

update_source_code() {
  info "【1/7】正在获取 GitHub 最新代码"

  OLD_COMMIT=$(git rev-parse HEAD)

  git fetch "$GIT_REMOTE" "$GIT_BRANCH"
  git merge --ff-only "${GIT_REMOTE}/${GIT_BRANCH}"

  NEW_COMMIT=$(git rev-parse HEAD)

  if [[ "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
    CHANGED_FILES=""
    warning "代码已经是最新版本"
    return
  fi

  CHANGED_FILES=$(git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT")
  success "代码更新完成：${OLD_COMMIT:0:7} → ${NEW_COMMIT:0:7}"
}

file_changed() {
  local pattern="$1"
  [[ -n "$CHANGED_FILES" ]] && grep -Eq "$pattern" <<< "$CHANGED_FILES"
}

get_current_commit_hash() {
  git rev-parse --short HEAD
}

get_current_commit_message() {
  git log -1 --pretty=%s
}

get_current_commit_author() {
  git log -1 --pretty=%an
}

get_current_commit_date() {
  git log -1 --pretty=%ad --date=format:'%Y-%m-%d %H:%M:%S'
}

# ==============================
# 数据库备份
# ==============================
step_backup_db() {
  info "【2/7】正在备份数据库"

  if [[ ! -f "$DB_FILE" ]]; then
    warning "未找到数据库文件，跳过数据库备份"
    return
  fi

  local db_check
  db_check=$(sqlite3 "$DB_FILE" "PRAGMA quick_check;")
  [[ "$db_check" == "ok" ]] \
    || fail "数据库完整性检查失败：${db_check}"

  local backup_file="${BACKUP_DIR}/dev-${TIMESTAMP}.db"
  sqlite3 "$DB_FILE" ".backup '${backup_file}'"

  [[ -s "$backup_file" ]] \
    || fail "数据库备份文件为空"

  success "数据库已备份：${backup_file}"

  # 清理旧备份，仅保留最近 KEEP_BACKUPS 份
  local -a old_backups
  mapfile -t old_backups < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'dev-*.db' \
      -printf '%T@ %p\n' |
    sort -nr |
    awk -v keep="$KEEP_BACKUPS" 'NR > keep {print $2}'
  )

  if (( ${#old_backups[@]} > 0 )); then
    rm -f -- "${old_backups[@]}"
    success "已清理旧备份，仅保留最近 ${KEEP_BACKUPS} 份"
  fi
}

# ==============================
# 依赖安装
# ==============================
step_install_deps() {
  info "【3/7】正在检查依赖变化"

  if ! file_changed '(^|/)(package\.json|package-lock\.json)$'; then
    success "依赖没有变化，跳过安装"
    return
  fi

  if [[ -f "$LOCK_FILE_PATH" ]]; then
    npm ci
  else
    npm install
  fi

  success "依赖安装完成"
}

# ==============================
# Prisma 同步
# ==============================
step_sync_prisma() {
  info "【4/7】正在检查 Prisma Schema"

  if ! file_changed '(^|/)prisma/schema\.prisma$'; then
    success "Prisma Schema 没有变化，跳过数据库同步"
    return
  fi

  npx prisma generate
  npx prisma db push

  success "Prisma Client 和数据库结构已同步"
}

# ==============================
# 构建
# ==============================
step_build() {
  info "【5/7】开始构建生产版本"

  # 保留上一版构建产物，供 rollback 使用
  if [[ -d ".next/standalone" ]]; then
    rm -rf .next/standalone-prev
    cp -r .next/standalone .next/standalone-prev
  fi

  # package.json 已固定为 next build --webpack
  npm run build

  [[ -f "$BUILD_OUTPUT" ]] \
    || fail "构建结束，但没有生成 ${BUILD_OUTPUT}"

  success "Webpack 生产构建成功"
}

# ==============================
# 服务重启
# ==============================
step_restart_service() {
  info "【6/7】正在重启 systemd 服务"

  systemctl restart "$SERVICE_NAME"

  if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl status "$SERVICE_NAME" --no-pager || true
    journalctl -u "$SERVICE_NAME" -n 50 --no-pager || true
    fail "服务重启失败"
  fi

  success "服务已成功重启"
}

# ==============================
# 健康检查
# ==============================
step_health_check() {
  info "【7/7】正在执行健康检查"

  local health_ok=false
  local attempt http_code

  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
    http_code=$(
      curl \
        --silent \
        --output /dev/null \
        --write-out '%{http_code}' \
        --max-time 5 \
        "$HEALTH_URL" || true
    )

    if [[ "$http_code" =~ ^(${HEALTH_SUCCESS_CODES})$ ]]; then
      health_ok=true
      break
    fi

    warning "健康检查第 ${attempt}/${HEALTH_RETRIES} 次未通过，HTTP ${http_code:-000}"
    sleep "$HEALTH_INTERVAL"
  done

  if [[ "$health_ok" != true ]]; then
    journalctl -u "$SERVICE_NAME" -n 80 --no-pager || true
    fail "服务已启动，但健康检查未通过"
  fi

  success "健康检查通过"
}

# ==============================
# 部署汇总
# ==============================
print_deploy_summary() {
  local commit_hash commit_message commit_author end_time duration

  commit_hash=$(get_current_commit_hash)
  commit_message=$(get_current_commit_message)
  commit_author=$(get_current_commit_author)
  end_time=$(date +%s)
  duration=$((end_time - START_TIME))

  printf '\n========================================\n'
  printf '\033[1;32m 部署成功\033[0m\n'
  printf ' 当前版本：%s\n' "$commit_hash"
  printf ' 提交信息：%s\n' "$commit_message"
  printf ' 提交作者：%s\n' "$commit_author"
  printf ' 数据库备份：%s\n' "$BACKUP_DIR"
  printf ' 部署日志：%s\n' "$LOG_FILE"
  printf ' 总耗时：%s 秒\n' "$duration"
  printf '========================================\n'
}

# ==============================
# 独立命令实现
# ==============================

# backup：仅备份数据库
cmd_backup() {
  require_root_user
  require_app_directory
  prepare_runtime
  acquire_deploy_lock
  step_backup_db
  success "备份命令执行完成"
}

# restart：仅重启服务
cmd_restart() {
  require_root_user
  require_app_directory
  prepare_runtime
  step_restart_service
  success "重启命令执行完成"
}

# health：仅健康检查
cmd_health() {
  require_app_directory
  prepare_runtime
  step_health_check
  success "健康检查命令执行完成"
}

# status：服务状态 + 当前版本 + 备份情况
cmd_status() {
  require_app_directory

  printf '\n========================================\n'
  printf ' %s 状态\n' "$APP_DISPLAY_NAME"
  printf '========================================\n'

  # 服务状态
  local service_state
  service_state=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "unknown")
  printf ' 服务状态：%s\n' "$service_state"

  # 开机自启
  local enabled_state
  enabled_state=$(systemctl is-enabled "$SERVICE_NAME" 2>/dev/null || echo "unknown")
  printf ' 开机自启：%s\n' "$enabled_state"

  # 当前版本
  printf ' 当前版本：%s\n' "$(get_current_commit_hash)"
  printf ' 提交信息：%s\n' "$(get_current_commit_message)"
  printf ' 提交作者：%s\n' "$(get_current_commit_author)"
  printf ' 提交时间：%s\n' "$(get_current_commit_date)"

  # 可回滚版本
  if [[ -d ".next/standalone-prev" ]]; then
    printf ' 可回滚版本：是（.next/standalone-prev 存在）\n'
  else
    printf ' 可回滚版本：否（无上一版本构建）\n'
  fi

  # 备份数量
  if [[ -d "$BACKUP_DIR" ]]; then
    local backup_count
    backup_count=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'dev-*.db' | wc -l)
    printf ' 数据库备份：%s 份（保留最近 %s 份）\n' "$backup_count" "$KEEP_BACKUPS"
  fi

  printf '========================================\n'
}

# version：仅显示当前版本
cmd_version() {
  require_app_directory
  printf '\n'
  printf '版本：%s\n' "$(get_current_commit_hash)"
  printf '信息：%s\n' "$(get_current_commit_message)"
  printf '作者：%s\n' "$(get_current_commit_author)"
  printf '时间：%s\n' "$(get_current_commit_date)"
}

# rollback：仅回滚代码构建，不回滚数据库
cmd_rollback() {
  require_root_user
  require_app_directory
  prepare_runtime
  acquire_deploy_lock

  warning "rollback 仅回滚代码构建，不回滚数据库"
  warning "如需恢复数据，请手动从 ${BACKUP_DIR} 选择对应时间点的备份恢复"

  if [[ ! -d ".next/standalone-prev" ]]; then
    fail "没有可回滚的上一版本构建（.next/standalone-prev 不存在）"
  fi

  info "正在回滚到上一版本构建..."

  rm -rf .next/standalone
  mv .next/standalone-prev .next/standalone

  success "已切换到上一版本构建"

  step_restart_service
  step_health_check

  printf '\n========================================\n'
  printf '\033[1;32m 回滚成功\033[0m\n'
  printf ' 当前版本：%s（代码未变，仅构建回滚）\n' "$(get_current_commit_hash)"
  printf ' 提醒：数据库未回滚，如需恢复数据请手动处理\n'
  printf ' 部署日志：%s\n' "$LOG_FILE"
  printf '========================================\n'
}

# deploy：完整部署流程
cmd_deploy() {
  require_root_user
  prepare_runtime
  check_required_commands
  acquire_deploy_lock
  require_app_directory
  require_clean_git_worktree
  check_git_branch

  update_source_code
  step_backup_db
  step_install_deps
  step_sync_prisma
  step_build
  step_restart_service
  step_health_check

  print_deploy_summary
}

# ==============================
# 命令分发
# ==============================
show_usage() {
  cat <<EOF
用法：$0 <命令>

可用命令：
  deploy     执行完整部署流程（拉代码 → 备份 → 依赖 → Prisma → 构建 → 重启 → 健康检查）
  backup     仅备份数据库
  restart    仅重启 systemd 服务
  health     仅执行健康检查
  status     查看服务状态、当前版本、备份情况
  version    查看当前部署的版本信息
  rollback   回滚到上一版本构建（仅代码，不回滚数据库）
  help       显示本帮助信息
EOF
}

dispatch() {
  local command="${1:-help}"
  shift || true

  case "$command" in
    deploy)    cmd_deploy "$@" ;;
    backup)    cmd_backup "$@" ;;
    restart)  cmd_restart "$@" ;;
    health)   cmd_health "$@" ;;
    status)   cmd_status "$@" ;;
    version)  cmd_version "$@" ;;
    rollback) cmd_rollback "$@" ;;
    help|-h|--help) show_usage ;;
    *)
      printf '\033[1;31m未知命令：%s\033[0m\n' "$command" >&2
      show_usage >&2
      exit 1
      ;;
  esac
}
