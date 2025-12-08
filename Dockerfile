# Use Node.js 22 LTS as base
FROM node:22-slim

# Install system dependencies including audiowaveform
RUN apt-get update && apt-get install -y \
    audiowaveform \
    libatomic1 \
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
