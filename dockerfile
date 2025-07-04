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

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY diagnostics/package*.json ./diagnostics/

# Install dependencies
RUN npm ci --only=production
RUN cd backend && npm ci --only=production
RUN cd diagnostics && npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs temp uploads

# Expose ports
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/api/health || exit 1

# Start the application
CMD ["npm", "run", "start:railway"]