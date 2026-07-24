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
  # KEEP_BACKUPS <= 0 时不清理，避免误删全部备份
  if (( KEEP_BACKUPS > 0 )); then
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
  fi
}

# ==============================
# 依赖安装
# ==============================
step_install_deps() {
  info "【3/7】正在检查依赖变化"

  # node_modules 不存在时必须安装（首次部署或被清理）
  if [[ ! -d "${APP_DIR}/node_modules" ]]; then
    info "node_modules 不存在，执行首次依赖安装"
    if [[ -f "$LOCK_FILE_PATH" ]]; then
      npm ci
    else
      npm install
    fi
    success "依赖安装完成"
    return
  fi

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

  local standalone_dir="${APP_DIR}/.next/standalone"
  local standalone_prev_dir="${APP_DIR}/.next/standalone-prev"

  # 保留上一版构建产物，供 rollback 使用
  if [[ -d "$standalone_dir" ]]; then
    rm -rf "$standalone_prev_dir"
    cp -r "$standalone_dir" "$standalone_prev_dir"
  fi

  # package.json 已固定为 next build --webpack
  npm run build

  [[ -f "$BUILD_OUTPUT" ]] \
    || fail "构建结束，但没有生成 ${BUILD_OUTPUT}"

  # 验证 standalone 静态资源与 public 已正确复制
  if [[ ! -d "${standalone_dir}/.next/static" ]]; then
    fail "构建产物缺少 .next/standalone/.next/static，请检查 package.json build 脚本"
  fi

  if [[ -d "${APP_DIR}/public" && ! -d "${standalone_dir}/public" ]]; then
    fail "构建产物缺少 .next/standalone/public，请检查 package.json build 脚本"
  fi

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

# health：仅健康检查（只读，不要求 root，不写日志）
cmd_health() {
  require_app_directory

  printf '\n========================================\n'
  printf ' %s 健康检查\n' "$APP_DISPLAY_NAME"
  printf ' 目标：%s\n' "$HEALTH_URL"
  printf '========================================\n'

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
  if [[ -d "${APP_DIR}/.next/standalone-prev" ]]; then
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

  local standalone_dir="${APP_DIR}/.next/standalone"
  local standalone_prev_dir="${APP_DIR}/.next/standalone-prev"

  warning "rollback 仅回滚代码构建，不回滚数据库"
  warning "如需恢复数据，请手动从 ${BACKUP_DIR} 选择对应时间点的备份恢复"

  if [[ ! -d "$standalone_prev_dir" ]]; then
    fail "没有可回滚的上一版本构建（.next/standalone-prev 不存在）"
  fi

  # 回滚前备份数据库（安全网，不自动覆盖现有数据库）
  step_backup_db

  info "正在回滚到上一版本构建..."

  rm -rf "$standalone_dir"
  mv "$standalone_prev_dir" "$standalone_dir"

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

# preflight：部署前只读预检（不执行任何写操作，不构建，不重启）
# 用途：首次部署前验证环境就绪，提前暴露必失败的问题
cmd_preflight() {
  require_root_user
  require_app_directory

  local pass_count=0
  local fail_count=0
  local warn_count=0
  local will_install_deps=false
  local will_sync_prisma=false
  local incoming_changes=""

  preflight_pass() { printf '  \033[1;32m✓\033[0m %s\n' "$1"; ((++pass_count)); }
  preflight_fail() { printf '  \033[1;31m✗\033[0m %s\n' "$1"; ((++fail_count)); }
  preflight_warn() { printf '  \033[1;33m!\033[0m %s\n' "$1"; ((++warn_count)); }

  printf '\n========================================\n'
  printf ' %s 部署预检（Dry Run）\n' "$APP_DISPLAY_NAME"
  printf ' 时间：%s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '========================================\n'

  info "【1/6】基础环境检查"
  # 必需命令
  local missing_cmds=()
  local cmd
  for cmd in git npm npx systemctl curl sqlite3 flock; do
    command -v "$cmd" >/dev/null 2>&1 || missing_cmds+=("$cmd")
  done
  if (( ${#missing_cmds[@]} == 0 )); then
    preflight_pass "必需命令齐全：git npm npx systemctl curl sqlite3 flock"
  else
    preflight_fail "缺少命令：${missing_cmds[*]}"
  fi

  # 项目目录
  if [[ -d "$APP_DIR" ]]; then
    preflight_pass "项目目录存在：$APP_DIR"
  else
    preflight_fail "项目目录不存在：$APP_DIR"
  fi

  info "【2/6】Git 仓库检查"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    preflight_pass "是 Git 仓库"
  else
    preflight_fail "不是 Git 仓库"
  fi

  # 工作区干净
  if [[ -z "$(git status --porcelain)" ]]; then
    preflight_pass "工作区干净"
  else
    preflight_fail "工作区有未提交/未跟踪文件（部署会拒绝）"
    git status --short | head -10
  fi

  # 分支
  local current_branch
  current_branch=$(git branch --show-current 2>/dev/null || echo "")
  if [[ "$current_branch" == "$GIT_BRANCH" ]]; then
    preflight_pass "当前分支：$GIT_BRANCH"
  else
    preflight_fail "当前分支是 ${current_branch}，要求 ${GIT_BRANCH}"
  fi

  info "【3/6】远程代码检查"
  # fetch（只下载对象，不改动工作区，安全）
  if git fetch "$GIT_REMOTE" "$GIT_BRANCH" 2>/dev/null; then
    preflight_pass "远程可访问，fetch 成功"
  else
    preflight_fail "无法 fetch 远程 ${GIT_REMOTE}/${GIT_BRANCH}"
  fi

  # 待拉取变更
  local local_head remote_head
  local_head=$(git rev-parse HEAD 2>/dev/null || echo "")
  remote_head=$(git rev-parse "${GIT_REMOTE}/${GIT_BRANCH}" 2>/dev/null || echo "")
  if [[ "$local_head" == "$remote_head" ]]; then
    preflight_warn "代码已是最新，无待拉取变更"
    incoming_changes=""
  else
    incoming_changes=$(git diff --name-only "$local_head" "$remote_head" 2>/dev/null || echo "")
    local change_count
    change_count=$(echo "$incoming_changes" | grep -c . 2>/dev/null || echo 0)
    preflight_pass "待拉取变更：${change_count} 个文件"
    echo "$incoming_changes" | head -10 | while read -r f; do
      [[ -n "$f" ]] && printf '     - %s\n' "$f"
    done
  fi

  info "【4/6】数据库与环境检查"
  # 数据库
  if [[ -f "$DB_FILE" ]]; then
    local db_check
    db_check=$(sqlite3 "$DB_FILE" "PRAGMA quick_check;" 2>/dev/null || echo "error")
    if [[ "$db_check" == "ok" ]]; then
      preflight_pass "数据库存在且完整：$DB_FILE"
    else
      preflight_fail "数据库完整性检查失败：$db_check"
    fi
  else
    preflight_warn "数据库不存在（首次部署，备份步骤将跳过）"
  fi

  # .env
  local env_file="${APP_DIR}/.env"
  if [[ -f "$env_file" ]]; then
    preflight_pass ".env 存在"
    # 检查 DATABASE_URL 是否绝对路径
    local db_url
    db_url=$(grep -E '^DATABASE_URL=' "$env_file" 2>/dev/null | head -1 || echo "")
    if [[ -z "$db_url" ]]; then
      preflight_warn ".env 未配置 DATABASE_URL"
    elif [[ "$db_url" =~ DATABASE_URL=\"file:/ ]]; then
      preflight_pass "DATABASE_URL 使用绝对路径"
    else
      preflight_fail "DATABASE_URL 不是绝对路径（standalone 模式会找不到数据库）"
      printf '     当前值：%s\n' "$db_url"
    fi
  else
    preflight_fail ".env 不存在：$env_file"
  fi

  # node_modules
  if [[ -d "${APP_DIR}/node_modules" ]]; then
    preflight_pass "node_modules 存在"
  else
    preflight_warn "node_modules 不存在 → 部署时会执行 npm ci/install"
    will_install_deps=true
  fi

  info "【5/6】服务配置检查"
  # systemd 服务单元
  if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${SERVICE_NAME}\.service"; then
    preflight_pass "systemd 服务已安装：${SERVICE_NAME}.service"
    local svc_state
    svc_state=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "unknown")
    printf '     当前状态：%s\n' "$svc_state"
  else
    preflight_fail "systemd 服务未安装：${SERVICE_NAME}.service（请先 cp zhinanguanxin.service 到 /etc/systemd/system/）"
  fi

  # Nginx（可选，仅提示）
  if [[ -f "/etc/nginx/sites-enabled/${APP_NAME}" ]] || [[ -f "/etc/nginx/conf.d/${APP_NAME}.conf" ]]; then
    preflight_pass "Nginx 站点已配置"
  else
    preflight_warn "未检测到 Nginx 站点配置（如不使用 Nginx 可忽略）"
  fi

  info "【6/6】执行计划预览"
  # 判断是否会装依赖
  if [[ "$will_install_deps" != true ]] && [[ -n "$incoming_changes" ]]; then
    if grep -Eq '(^|/)(package\.json|package-lock\.json)$' <<< "$incoming_changes"; then
      will_install_deps=true
    fi
  fi
  # 判断是否会同步 Prisma
  if [[ -n "$incoming_changes" ]] && grep -Eq '(^|/)prisma/schema\.prisma$' <<< "$incoming_changes"; then
    will_sync_prisma=true
  fi

  printf '  1. 备份数据库 → %s/dev-{时间戳}.db\n' "$BACKUP_DIR"
  if [[ "$will_install_deps" == true ]]; then
    printf '  2. 安装依赖 → %s\n' "$([[ -f "$LOCK_FILE_PATH" ]] && echo "npm ci" || echo "npm install")"
  else
    printf '  2. 安装依赖 → 跳过（依赖无变化）\n'
  fi
  if [[ "$will_sync_prisma" == true ]]; then
    printf '  3. Prisma → prisma generate + db push（schema 有变化）\n'
  else
    printf '  3. Prisma → 跳过（schema 无变化）\n'
  fi
  printf '  4. 构建 → next build --webpack\n'
  printf '  5. 重启 → systemctl restart %s\n' "$SERVICE_NAME"
  printf '  6. 健康检查 → %s\n' "$HEALTH_URL"

  printf '\n========================================\n'
  printf ' 预检结果：%s 通过 / %s 警告 / %s 失败\n' "$pass_count" "$warn_count" "$fail_count"
  if (( fail_count > 0 )); then
    printf '\033[1;31m 不可部署：存在 %s 项失败，请先修复\033[0m\n' "$fail_count"
    printf '========================================\n'
    exit 1
  elif (( warn_count > 0 )); then
    printf '\033[1;33m 可以部署：有 %s 项提示，部署时会自动处理\033[0m\n' "$warn_count"
  else
    printf '\033[1;32m 可以部署：环境完全就绪\033[0m\n'
  fi
  printf '========================================\n'
}

# ==============================
# 命令分发
# ==============================
show_usage() {
  cat <<EOF
用法：$0 <命令>

可用命令：
  deploy     执行完整部署流程（拉代码 → 备份 → 依赖 → Prisma → 构建 → 重启 → 健康检查）
  preflight  部署前只读预检（Dry Run，不执行任何写操作）
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
    preflight) cmd_preflight "$@" ;;
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
