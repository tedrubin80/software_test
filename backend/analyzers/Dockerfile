# FILE LOCATION: /Dockerfile (root directory)
# Docker configuration for Railway deployment

FROM node:18-alpine

# Install Chrome dependencies for Lighthouse
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY diagnostics/package*.json ./diagnostics/

# Install dependencies
RUN npm ci --only=production
RUN cd backend && npm ci --only=production
RUN cd diagnostics && npm ci --only=production

# Copy all application files
COPY . .

# Verify frontend files are copied correctly
RUN ls -la && \
    echo "=== Checking frontend directory ===" && \
    ls -la frontend/ || echo "Frontend directory not found!" && \
    echo "=== Checking for index.html ===" && \
    test -f frontend/index.html && echo "✅ frontend/index.html found" || echo "❌ frontend/index.html NOT FOUND"

# Create necessary directories
RUN mkdir -p logs temp uploads

# Set proper permissions
RUN chmod -R 755 frontend

# Expose port (Railway will set this)
EXPOSE ${PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:${PORT:-3000}/health || exit 1

# Start the application with the railway server
CMD ["node", "railway-server.js"]