# Custom SSHpiper Docker Image
# Based on https://github.com/tg123/sshpiper/blob/master/Dockerfile
# Adds flexible port, server-key, and workingdir configuration

FROM farmer1992/sshpiperd:latest as upstream

# Use alpine for small size and flexibility
FROM alpine:latest

# Install required packages
RUN apk add --no-cache \
    ca-certificates \
    openssh-keygen \
    bash

# Create sshpiper user and group
ARG SSHPIPERD_USER_ID=1000
ARG SSHPIPERD_GROUP_ID=1000
RUN addgroup -g $SSHPIPERD_GROUP_ID sshpiperd && \
    adduser -u $SSHPIPERD_USER_ID -G sshpiperd -s /bin/bash -D sshpiperd

# Copy sshpiperd binary and plugins from upstream image
COPY --from=upstream /sshpiperd/sshpiperd /usr/local/bin/sshpiperd
COPY --from=upstream /sshpiperd/plugins /usr/local/bin/plugins

# Create necessary directories
RUN mkdir -p /etc/ssh /var/sshpiper /etc/sshpiper && \
    chown -R sshpiperd:sshpiperd /var/sshpiper /etc/sshpiper

# Create entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Default environment variables
ENV SSHPIPER_PORT=2222
ENV SSHPIPER_SERVER_KEY=""
ENV SSHPIPER_WORKINGDIR_ROOT="/var/sshpiper"
ENV SSHPIPER_LOG_LEVEL="info"
ENV SSHPIPER_UPSTREAM_DRIVER="workingdir"

# Expose configurable port
EXPOSE $SSHPIPER_PORT

# Switch to sshpiper user
USER sshpiperd

# Use custom entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD []