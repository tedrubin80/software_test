# File Location: testlab/docker-compose.yml
# Optional Docker Compose configuration

version: '3.8'

services:
  # Add to your existing services
  ai-routing:
    build: 
      context: ./backend/ai_system
      dockerfile: Dockerfile
    container_name: testlab-ai-routing
    ports:
      - "3003:3003"
    environment:
      - AI_ROUTING_PORT=3003
      - AI_CONFIG_PATH=/app/config/routing_config.yaml
      - AI_DATA_DIR=/data
    volumes:
      - /data:/data:ro  # Mount data volume as read-only
      - ./backend/config:/app/config
      - ./logs:/app/logs
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - testlab-network

# Make sure this network exists
networks:
  testlab-network:
    driver: bridge