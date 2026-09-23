# 多阶段构建 - 前端 Dockerfile
# 使用本地预构建的 dist 产物（解决容器内网络不可达问题）

# 生产阶段
FROM nginx:1.25-alpine

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制本地构建产物
COPY dist /usr/share/nginx/html

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
# 必须用 127.0.0.1 而非 localhost：镜像内 localhost 解析为 ::1（IPv6），
# 而 nginx 仅绑定 0.0.0.0:80（IPv4），用 localhost 会连接被拒、健康检查恒报 unhealthy（假阳性）。
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:80 || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
