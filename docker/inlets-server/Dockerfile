# Inlets OSS Server for Claude Web
FROM alpine:3.19

# Install dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    bash \
    nodejs \
    npm \
    supervisor

# Install inlets server
RUN curl -sLS https://get.arkade.dev | sh && \
    arkade get inlets && \
    mv /root/.arkade/bin/inlets /usr/local/bin/ && \
    rm -rf /root/.arkade && \
    chmod +x /usr/local/bin/inlets

# Create a non-root user
RUN adduser -D -s /bin/bash inlets

# Create directories for data and logs
RUN mkdir -p /var/log/inlets /data && \
    chown -R inlets:inlets /var/log/inlets /data

# Copy scripts and configuration
COPY start-inlets.sh /usr/local/bin/start-inlets
COPY status-server.js /usr/local/bin/status-server
COPY supervisord.conf /etc/supervisord.conf
RUN chmod +x /usr/local/bin/start-inlets /usr/local/bin/status-server

# Switch to non-root user
USER inlets
WORKDIR /home/inlets

# Expose ports
# 8090 - Control plane (WebSocket connections from clients)
# 8080 - Data plane (HTTP traffic)
# 8091 - Status API
EXPOSE 8090 8080 8091

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8091/health || exit 1

# Switch back to root for supervisor
USER root

# Start services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]