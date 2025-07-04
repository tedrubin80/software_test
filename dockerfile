# FILE LOCATION: /Dockerfile (root directory)
# Simple Dockerfile for Railway deployment debugging

FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create directories and ensure permissions
RUN mkdir -p frontend backend && \
    chmod -R 755 .

# Show what files we have (for debugging)
RUN echo "=== Files in /app ===" && \
    ls -la && \
    echo "=== Files in /app/frontend ===" && \
    ls -la frontend/ || echo "No frontend directory" && \
    echo "=== Environment ===" && \
    echo "NODE_ENV: $NODE_ENV" && \
    echo "PORT: $PORT"

# Expose port (Railway sets this automatically)
EXPOSE ${PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Use the simple server for debugging
CMD ["node", "simple-server.js"]