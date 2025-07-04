# FILE LOCATION: /Dockerfile (root directory - NO extension, just "Dockerfile")
FROM node:18-alpine

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files
COPY . .

# Remove any conflicting server files
RUN rm -f railway-server.js combined-server.js || true

# Show what we have for debugging
RUN echo "Files in /app:" && ls -la

# The port Railway provides
EXPOSE ${PORT}

# Start the simple server
CMD ["node", "simple-server.js"]