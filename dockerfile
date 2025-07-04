# FILE LOCATION: /Dockerfile (root directory)
# Docker configuration for Railway deployment

FROM node:18-alpine

# Install Chrome dependencies for Lighthouse (if needed later)
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

# Install dependencies
RUN npm install --production
RUN cd backend && npm install --production || echo "Backend dependencies optional"

# Copy all application files
COPY . .

# Create necessary directories
RUN mkdir -p logs temp uploads backend

# Set proper permissions
RUN chmod -R 755 frontend backend

# Expose port (Railway will set this)
EXPOSE ${PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:${PORT:-3000}/api/health || exit 1

# Start the combined server
CMD ["node", "combined-server.js"]