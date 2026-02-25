FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Core tools + media
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    unzip \
    ca-certificates \
    gnupg \
    sudo \
    wget \
    jq \
    ripgrep \
    tree \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# Remove ImageMagick restrictive policy so the agent can use it freely
RUN if [ -f /etc/ImageMagick-6/policy.xml ]; then \
      sed -i 's/<policy domain="coder".*rights="none".*pattern="\(.*\)"/<policy domain="coder" rights="read|write" pattern="\1"/' /etc/ImageMagick-6/policy.xml; \
    fi

# Node.js 22 LTS via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Bun
RUN curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/bun \
    && ln -s /usr/local/bin/bun /usr/local/bin/bunx \
    && rm -rf /root/.bun

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# JDK 17 for React Native / Android builds
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-arm64

# Create non-root dev user
RUN useradd -m -s /bin/bash dev \
    && echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Bake in the claude config (settings + CLAUDE.md)
# These are the controlled files — runtime state goes to a mounted volume
COPY claude-config/settings.json /home/dev/.claude/settings.json
COPY claude-config/CLAUDE.md /home/dev/.claude/CLAUDE.md
RUN chown -R dev:dev /home/dev/.claude

USER dev
WORKDIR /workspace

ENTRYPOINT ["claude"]
CMD ["-p", "--output-format", "json"]
