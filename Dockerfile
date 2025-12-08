# Use Ubuntu 22.04 as base
FROM ubuntu:22.04

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js 22 and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install ffmpeg (includes ffprobe) and audiowaveform
RUN wget -O /tmp/audiowaveform.deb https://github.com/bbc/audiowaveform/releases/download/1.10.1/audiowaveform_1.10.1-1-12_amd64.deb \
    && apt-get update \
    && apt-get install -y ffmpeg /tmp/audiowaveform.deb \
    && rm /tmp/audiowaveform.deb \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build application
RUN pnpm run build

# Expose port (Railway will override this with PORT env var)
EXPOSE 3000

# Start application
CMD ["pnpm", "run", "start"]
