FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Copy source files and config
COPY tsconfig.json ./
COPY src ./src

# Install dependencies (triggers build via prepare script)
RUN npm ci

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose HTTP server port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start HTTP server
CMD ["node", "dist/http-server.js"]
