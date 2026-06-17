FROM nginx:1.25-alpine

# 复制配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 创建非 root 用户
RUN addgroup -g 1001 -S workbench && \
    adduser -u 1001 -S workbench -G workbench && \
    chown -R workbench:workbench /var/cache/nginx && \
    chown -R workbench:workbench /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R workbench:workbench /var/run/nginx.pid

USER workbench

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
