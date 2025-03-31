#!/bin/bash

# 服务器地址
SERVER="root@47.100.179.54"

# 创建远程目录
ssh "$SERVER" "mkdir -p ~/ai-chatbot"

# 复制除 node_modules、.next 和 .git 之外的所有文件和目录到服务器
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.git' ./ "$SERVER:~/ai-chatbot/"

# # 在服务器上执行部署命令
ssh "$SERVER" "cd ~/ai-chatbot && \
    docker-compose up -d --build"

echo "Deployment completed!"