# 多阶段构建 - 前端 Dockerfile

# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* ./

# 安装依赖（无 lock 文件时使用 npm install）
RUN npm install

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build

# 生产阶段
FROM nginx:1.25-alpine

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 创建非 root 用户
RUN addgroup -g 1001 -S workbench && \
    adduser -u 1001 -S workbench -G workbench && \
    chown -R workbench:workbench /usr/share/nginx/html && \
    chown -R workbench:workbench /var/cache/nginx && \
    chown -R workbench:workbench /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R workbench:workbench /var/run/nginx.pid

USER workbench

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:80 || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
