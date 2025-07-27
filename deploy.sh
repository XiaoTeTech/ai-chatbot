#!/bin/bash

# 配置变量
SERVER="root@47.100.179.54"
IMAGE_NAME="ai-chatbot"
IMAGE_TAG="latest"

echo "🚀 开始本地构建和部署流程..."

# 1. 本地构建 Docker 镜像
echo "📦 本地构建 Docker 镜像..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

if [ $? -ne 0 ]; then
    echo "❌ Docker 镜像构建失败"
    exit 1
fi

# 2. 导出镜像为 tar 文件
echo "📦 导出镜像文件..."
docker save -o ${IMAGE_NAME}.tar ${IMAGE_NAME}:${IMAGE_TAG}

if [ $? -ne 0 ]; then
    echo "❌ 镜像导出失败"
    exit 1
fi

# 3. 传输镜像文件和配置到服务器
echo "� 传输文件到服务器..."
ssh "$SERVER" "mkdir -p ~/ai-chatbot"
scp ${IMAGE_NAME}.tar "$SERVER:~/ai-chatbot/"
scp docker-compose.yml "$SERVER:~/ai-chatbot/"
scp .env "$SERVER:~/ai-chatbot/.env"

# 4. 在服务器上加载镜像并重启服务
echo "🔄 在服务器上加载镜像并重启服务..."
ssh "$SERVER" "cd ~/ai-chatbot && \
    docker load -i ${IMAGE_NAME}.tar && \
    docker-compose down && \
    docker-compose up -d && \
    rm ${IMAGE_NAME}.tar"

# 5. 运行数据库迁移
echo "🗄️  运行数据库迁移..."
ssh "$SERVER" "cd ~/ai-chatbot && \
    docker-compose exec -T ai-chatbot pnpm tsx lib/db/migrate"

# 6. 清理本地临时文件
echo "🧹 清理本地临时文件..."
rm ${IMAGE_NAME}.tar

echo "✅ 部署完成！"