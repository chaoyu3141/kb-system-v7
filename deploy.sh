#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

# ==============================
# 知南观心知识库部署配置
# ==============================
APP_NAME="zhinanguanxin"
APP_DIR="/var/www/zhinanguanxin"
SERVICE_NAME="zhinanguanxin"

REMOTE_NAME="origin"
DEPLOY_BRANCH="main"

DB_FILE="${APP_DIR}/prisma/dev.db"
BACKUP_DIR="/var/backups/${APP_NAME}"
KEEP_BACKUPS=20

HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_RETRIES=15
HEALTH_INTERVAL=2

LOCK_FILE="/var/lock/${APP_NAME}-deploy.lock"
LOG_DIR="/var/log/${APP_NAME}"

START_TIME=$(date +%s)
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="${LOG_DIR}/deploy-${TIMESTAMP}.log"

OLD_COMMIT=""
NEW_COMMIT=""
CHANGED_FILES=""

# ==============================
# 输出函数
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
  printf '\033[1;31m日志文件：%s\033[0m\n' "$LOG_FILE"
  printf '\033[1;31m========================================\033[0m\n'

  exit "$exit_code"
}

trap 'on_error $LINENO' ERR

# ==============================
# 基础检查
# ==============================
if [[ "${EUID}" -ne 0 ]]; then
  fail "请使用 root 用户执行 deploy.sh"
fi

mkdir -p "$LOG_DIR" "$BACKUP_DIR"

# 同时输出到终端和日志文件
exec > >(tee -a "$LOG_FILE") 2>&1

printf '\n========================================\n'
printf ' 知南观心知识库自动部署\n'
printf ' 时间：%s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
printf '========================================\n'

for command in git npm npx systemctl curl sqlite3 flock; do
  command -v "$command" >/dev/null 2>&1 || fail "缺少命令：${command}"
done

[[ -d "$APP_DIR" ]] || fail "项目目录不存在：${APP_DIR}"

# 防止重复部署
exec 9>"$LOCK_FILE"
flock -n 9 || fail "已有部署任务正在运行，请稍后再试"

cd "$APP_DIR"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || fail "当前目录不是 Git 仓库"

CURRENT_BRANCH=$(git branch --show-current)

[[ "$CURRENT_BRANCH" == "$DEPLOY_BRANCH" ]] \
  || fail "当前分支是 ${CURRENT_BRANCH}，要求分支为 ${DEPLOY_BRANCH}"

# 不允许服务器存在未提交源码改动
if [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  fail "服务器存在未提交或未跟踪的文件，请先处理，部署已停止"
fi

OLD_COMMIT=$(git rev-parse HEAD)

# ==============================
# 1. 获取最新代码
# ==============================
info "【1/7】正在获取 GitHub 最新代码"

git fetch "$REMOTE_NAME" "$DEPLOY_BRANCH"
git merge --ff-only "${REMOTE_NAME}/${DEPLOY_BRANCH}"

NEW_COMMIT=$(git rev-parse HEAD)

if [[ "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
  warning "代码已经是最新版本"
  CHANGED_FILES=""
else
  CHANGED_FILES=$(git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT")
  success "代码更新完成：${OLD_COMMIT:0:7} → ${NEW_COMMIT:0:7}"
fi

# ==============================
# 2. 备份数据库
# ==============================
info "【2/7】正在备份数据库"

if [[ -f "$DB_FILE" ]]; then
  DB_CHECK=$(sqlite3 "$DB_FILE" "PRAGMA quick_check;")

  [[ "$DB_CHECK" == "ok" ]] \
    || fail "数据库完整性检查失败：${DB_CHECK}"

  BACKUP_FILE="${BACKUP_DIR}/dev-${TIMESTAMP}.db"

  # 使用 SQLite 官方备份方式，避免直接复制时数据不完整
  sqlite3 "$DB_FILE" ".backup '${BACKUP_FILE}'"

  [[ -s "$BACKUP_FILE" ]] \
    || fail "数据库备份文件为空"

  success "数据库已备份：${BACKUP_FILE}"

  # 只保留最近指定数量的备份
  mapfile -t OLD_BACKUPS < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'dev-*.db' \
      -printf '%T@ %p\n' |
    sort -nr |
    awk -v keep="$KEEP_BACKUPS" 'NR > keep {print $2}'
  )

  if (( ${#OLD_BACKUPS[@]} > 0 )); then
    rm -f -- "${OLD_BACKUPS[@]}"
    success "已清理旧备份，仅保留最近 ${KEEP_BACKUPS} 份"
  fi
else
  warning "未找到数据库文件，跳过数据库备份"
fi

# ==============================
# 3. 安装依赖
# ==============================
info "【3/7】正在检查依赖变化"

if grep -Eq '(^|/)(package\.json|package-lock\.json)$' <<< "$CHANGED_FILES"; then
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi

  success "依赖安装完成"
else
  success "依赖没有变化，跳过安装"
fi

# ==============================
# 4. 同步 Prisma
# ==============================
info "【4/7】正在检查 Prisma Schema"

if grep -Eq '(^|/)prisma/schema\.prisma$' <<< "$CHANGED_FILES"; then
  npx prisma generate
  npx prisma db push

  success "Prisma Client 和数据库结构已同步"
else
  success "Prisma Schema 没有变化，跳过数据库同步"
fi

# ==============================
# 5. 构建项目
# ==============================
info "【5/7】开始构建生产版本"

# package.json 已固定为 next build --webpack
npm run build

[[ -f ".next/standalone/server.js" ]] \
  || fail "构建结束，但没有生成 .next/standalone/server.js"

success "Webpack 生产构建成功"

# ==============================
# 6. 重启服务
# ==============================
info "【6/7】正在重启 systemd 服务"

systemctl restart "$SERVICE_NAME"

if ! systemctl is-active --quiet "$SERVICE_NAME"; then
  systemctl status "$SERVICE_NAME" --no-pager || true
  journalctl -u "$SERVICE_NAME" -n 50 --no-pager || true
  fail "服务重启失败"
fi

success "服务已成功重启"

# ==============================
# 7. 健康检查
# ==============================
info "【7/7】正在执行健康检查"

HEALTH_OK=false

for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
  HTTP_CODE=$(
    curl \
      --silent \
      --output /dev/null \
      --write-out '%{http_code}' \
      --max-time 5 \
      "$HEALTH_URL" || true
  )

  if [[ "$HTTP_CODE" =~ ^(200|301|302|307|308)$ ]]; then
    HEALTH_OK=true
    break
  fi

  warning "健康检查第 ${attempt}/${HEALTH_RETRIES} 次未通过，HTTP ${HTTP_CODE:-000}"
  sleep "$HEALTH_INTERVAL"
done

if [[ "$HEALTH_OK" != true ]]; then
  journalctl -u "$SERVICE_NAME" -n 80 --no-pager || true
  fail "服务已启动，但健康检查未通过"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

COMMIT_MESSAGE=$(git log -1 --pretty=%s)
COMMIT_AUTHOR=$(git log -1 --pretty=%an)

printf '\n========================================\n'
printf '\033[1;32m 部署成功\033[0m\n'
printf ' 当前版本：%s\n' "${NEW_COMMIT:0:7}"
printf ' 提交信息：%s\n' "$COMMIT_MESSAGE"
printf ' 提交作者：%s\n' "$COMMIT_AUTHOR"
printf ' 数据库备份：%s\n' "$BACKUP_DIR"
printf ' 部署日志：%s\n' "$LOG_FILE"
printf ' 总耗时：%s 秒\n' "$DURATION"
printf '========================================\n'
