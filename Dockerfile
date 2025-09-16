# Use the official Node.js image as a base
FROM node:20-slim

# Ensure system CA bundle exists (for HTTPS/TLS)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && update-ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

# Copy lockfile + package.json first
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copy source and build
COPY . .
RUN pnpm build

# If you don't actually serve HTTP, EXPOSE is optional
EXPOSE 8080

CMD ["pnpm", "start"]
