# 📡 TestLab API Documentation

Complete API reference for TestLab services.

## Backend API (Port 3001)

### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### Health Check
```http
GET /api/health
```

## Diagnostics API (Port 3002)

### Website Analysis
```http
POST /api/diagnose-website
Content-Type: application/json

{
  "url": "https://example.com",
  "enabledAIs": ["chatgpt", "claude", "llama"]
}
```

### Service Status
```http
GET /api/diagnostic-status
```

## Response Formats

See examples in the [examples](examples/) directory.
