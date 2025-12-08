# Use Node.js 22 LTS as base
FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    libatomic1 \
    libsndfile1 \
    libmad0 \
    libid3tag0 \
    libflac12 \
    && rm -rf /var/lib/apt/lists/*

# Download and install audiowaveform binary from GitHub releases
RUN wget -O /tmp/audiowaveform.deb https://github.com/bbc/audiowaveform/releases/download/1.10.1/audiowaveform_1.10.1-1-12_amd64.deb \
    && dpkg -i /tmp/audiowaveform.deb || apt-get install -f -y \
    && rm /tmp/audiowaveform.deb

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
