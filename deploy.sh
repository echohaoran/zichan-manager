#!/bin/bash
set -e

VERSION=$(git -C $(dirname "$0") describe --tags --abbrev=0 2>/dev/null || echo dev)
COMMIT=$(git -C $(dirname "$0") rev-parse --short HEAD 2>/dev/null || echo unknown)

echo "当前版本: ${VERSION} (${COMMIT})"
echo "正在构建镜像..."
docker compose build

echo "正在停止旧容器..."
docker compose down 2>/dev/null || true

echo "正在启动容器..."
docker compose up -d

echo ""
echo "========================================="
echo "  部署完成！"
echo "  版本: ${VERSION} (${COMMIT})"
echo "  前端: http://192.168.10.83:8080"
echo "  后端 API: http://192.168.10.83:8000/docs"
echo "  登录: admin / admin123"
echo "========================================="
