#!/usr/bin/env bash
# deploy.sh — 部署命令入口
# 用法：./scripts/deploy/deploy.sh <command>
# 命令：deploy | backup | restart | health | status | version | rollback | help

# 定位脚本所在目录（支持从任意路径调用）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载配置与函数库
source "${SCRIPT_DIR}/config.sh"
source "${SCRIPT_DIR}/lib.sh"

# 分发命令
dispatch "$@"
