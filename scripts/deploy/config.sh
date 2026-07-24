#!/usr/bin/env bash

# ==============================
# 项目基础配置
# ==============================
APP_NAME="zhinanguanxin"
APP_DISPLAY_NAME="知南观心知识库"
APP_DIR="/var/www/zhinanguanxin"

# ==============================
# Git 配置
# ==============================
GIT_REMOTE="origin"
GIT_BRANCH="main"

# ==============================
# systemd 服务配置
# ==============================
SERVICE_NAME="zhinanguanxin"

# ==============================
# 数据库与备份配置
# ==============================
DB_FILE="${APP_DIR}/prisma/dev.db"
BACKUP_DIR="/var/backups/${APP_NAME}"
KEEP_BACKUPS=20

# ==============================
# 构建配置
# ==============================
PACKAGE_FILE="${APP_DIR}/package.json"
LOCK_FILE_PATH="${APP_DIR}/package-lock.json"
PRISMA_SCHEMA="${APP_DIR}/prisma/schema.prisma"
BUILD_OUTPUT="${APP_DIR}/.next/standalone/server.js"

# ==============================
# 健康检查配置
# ==============================
HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_RETRIES=15
HEALTH_INTERVAL=2
HEALTH_SUCCESS_CODES="200|301|302|307|308"

# ==============================
# 部署运行配置
# ==============================
DEPLOY_LOCK_FILE="/var/lock/${APP_NAME}-deploy.lock"
DEPLOY_LOG_DIR="/var/log/${APP_NAME}"
REQUIRE_ROOT=true
