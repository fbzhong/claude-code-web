# Development container image for Claude Web
# This image is used for user containers when CONTAINER_MODE=true

FROM ubuntu:22.04

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update and install basic development tools
RUN apt-get update && apt-get install -y \
    # Essential tools
    curl \
    wget \
    git \
    vim \
    nano \
    less \
    htop \
    # Build tools
    build-essential \
    cmake \
    make \
    # Programming languages
    python3 \
    python3-pip \
    nodejs \
    npm \
    # Network tools
    net-tools \
    iputils-ping \
    traceroute \
    # Shell and terminal
    bash \
    zsh \
    tmux \
    # Utilities
    jq \
    tree \
    unzip \
    zip \
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

# Install some common development tools via npm
RUN npm install -g \
    yarn \
    pnpm \
    typescript \
    ts-node \
    nodemon

# Install common Python packages
RUN pip3 install --user \
    requests \
    numpy \
    pandas \
    matplotlib \
    jupyter

# Configure git
RUN git config --global init.defaultBranch main && \
    git config --global color.ui auto

# Set shell prompt
RUN echo 'export PS1="\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "' >> ~/.bashrc

# Keep container running
CMD ["/bin/bash", "-c", "while true; do sleep 1000; done"]