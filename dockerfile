# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy all application files
COPY . .

# Remove any conflicting server files
RUN rm -f railway-server.js combined-server.js app.js server.js || true

# Create necessary directories
RUN mkdir -p frontend logs

# The port Railway provides
EXPOSE ${PORT}

# Start the application
CMD ["node", "simple-server.js"]