# Development container image for Claude Web
# This image is used for user containers when CONTAINER_MODE=true

FROM ubuntu:22.04

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update and install essential development tools only
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
    nodejs \
    npm \
    # Locale support
    locales \
    && rm -rf /var/lib/apt/lists/*

# Generate locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Create developer user
RUN useradd -m -s /bin/bash developer && \
    echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

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

# Keep container running
CMD ["/bin/bash", "-c", "while true; do sleep 1000; done"]