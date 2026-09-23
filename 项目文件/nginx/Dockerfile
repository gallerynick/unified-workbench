FROM nginx:1.25-alpine

# 复制配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY includes/ /etc/nginx/includes/
COPY ssl/ /etc/nginx/ssl/

# 创建非 root 用户
RUN addgroup -g 1001 -S workbench && \
    adduser -u 1001 -S workbench -G workbench && \
    chown -R workbench:workbench /var/cache/nginx && \
    chown -R workbench:workbench /var/log/nginx && \
    chown -R workbench:workbench /etc/nginx/ssl && \
    touch /var/run/nginx.pid && \
    chown -R workbench:workbench /var/run/nginx.pid

USER workbench

# 健康检查
# 两处修正：
# 1) 用 127.0.0.1 而非 localhost（容器内 localhost 解析为 ::1，nginx 仅监听 IPv4）
# 2) 80 端口全量 301 跳转 HTTPS，而 wget --spider 不跟随重定向，必然失败；
#    故直连 443，并用 --no-check-certificate 跳过自签证书校验。
# 该检查经 location /health 反代至 backend /api/v1/health，
# 因此同时验证 nginx 配置与上游连通性，而非仅 nginx 进程存活。
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider --no-check-certificate https://127.0.0.1:443/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
