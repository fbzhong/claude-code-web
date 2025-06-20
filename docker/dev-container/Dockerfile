# Development container image for Claude Code Web
# This image is used for user containers when CONTAINER_MODE=true

FROM ubuntu:22.04

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update and install essential development tools
RUN apt-get update && apt-get install -y \
    # Essential tools
    git \
    vim \
    nano \
    curl \
    wget \
    # Build tools
    build-essential \
    # Programming languages
    python3 \
    # SSH server
    openssh-server \
    # System tools
    sudo \
    # Locale support
    locales \
    # Dependencies for NodeSource
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 from NodeSource
ENV NODE_MAJOR=22
RUN curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Generate locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Create developer user
RUN useradd -m -s /bin/bash developer && \
    echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Configure SSH server
RUN mkdir -p /var/run/sshd && \
    echo 'PermitRootLogin no' >> /etc/ssh/sshd_config && \
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config && \
    echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config && \
    echo 'AuthorizedKeysFile .ssh/authorized_keys' >> /etc/ssh/sshd_config

# Copy SSHpiper's public key for authentication
COPY sshpiper_id_rsa.pub /tmp/sshpiper_id_rsa.pub

# Save SSHpiper's public key to /root/.ssh for later restoration
RUN mkdir -p /root/.ssh && \
    cp /tmp/sshpiper_id_rsa.pub /root/.ssh/authorized_keys && \
    chmod 700 /root/.ssh && \
    chmod 600 /root/.ssh/authorized_keys && \
    rm /tmp/sshpiper_id_rsa.pub

# Set up developer home directory
USER developer
WORKDIR /home/developer

# Create basic directory structure
RUN mkdir -p ~/.ssh ~/.config ~/workspace

# Configure git
RUN git config --global init.defaultBranch main && \
    git config --global color.ui auto

# Set shell prompt
RUN echo 'export PS1="\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "' >> ~/.bashrc

# Create startup script
USER root
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Generate SSH host keys if they don'\''t exist\n\
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then\n\
    echo "Generating SSH host keys..."\n\
    ssh-keygen -A\n\
fi\n\
\n\
# Restore SSH authorized_keys if not exist\n\
if [ ! -f /home/developer/.ssh/authorized_keys ]; then\n\
    echo "Restoring SSH authorized_keys..."\n\
    mkdir -p /home/developer/.ssh\n\
    cp /root/.ssh/authorized_keys /home/developer/.ssh/\n\
    chmod 700 /home/developer/.ssh\n\
    chmod 600 /home/developer/.ssh/authorized_keys\n\
    chown -R developer:developer /home/developer/.ssh\n\
fi\n\
\n\
# Create required directories\n\
mkdir -p /var/run/sshd\n\
\n\
# Start SSH service\n\
echo "Starting SSH service..."\n\
/usr/sbin/sshd -D &\n\
SSHD_PID=$!\n\
\n\
# Wait a bit to ensure SSHD starts\n\
sleep 2\n\
\n\
# Check if SSHD is running\n\
if ps -p $SSHD_PID > /dev/null 2>&1; then\n\
    echo "SSH service started successfully on port 22"\n\
else\n\
    echo "Failed to start SSH service"\n\
    exit 1\n\
fi\n\
\n\
# Keep container running\n\
echo "Container ready, keeping it alive..."\n\
while true; do sleep 3600; done' > /startup.sh && \
    chmod +x /startup.sh

# Keep container running and start SSHD
CMD ["/startup.sh"]
