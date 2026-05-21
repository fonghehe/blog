---
title: "Frontend Deployment: nginx Configuration and Caching Strategy"
date: 2018-06-12 17:34:52
tags:
  - Engineering
readingTime: 2
description: "I've written a lot of frontend code, but the deployment part has always depended on ops colleagues. This time I configured nginx myself and compiled the common "
wordCount: 156
---

I've written a lot of frontend code, but the deployment part has always depended on ops colleagues. This time I configured nginx myself and compiled the common scenarios here.

## Basics: Hosting an SPA

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/myapp/dist;
  index index.html;

  # Key SPA config: all paths return index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

What `try_files $uri $uri/ /index.html` means:

1. First look for the file `$uri` (e.g. `/static/main.js`)
2. Then look for the directory `$uri/`
3. If neither exists, return `/index.html` (hand off to the frontend router)

## Caching Configuration

### HTML: No Cache

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  add_header Pragma "no-cache";
  add_header Expires 0;
}
```

### Hashed Static Assets: Long-Term Cache

```nginx
location ~* \.(js|css)$ {
  # Filenames include a hash (e.g. app.a1b2c3d4.js), so they can be cached forever
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location ~* \.(png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30 days
}
```

## gzip Compression

```nginx
http {
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;  # don't compress files smaller than 1KB
  gzip_comp_level 6;     # compression level 1-9; 6 balances speed and ratio
  gzip_types
    text/plain
    text/css
    text/javascript
    application/javascript
    application/json
    application/xml
    image/svg+xml;
}
```

If the build already generates `.gz` files, you can serve them directly to avoid runtime compression:

```nginx
# Enable compression-webpack-plugin in Webpack to generate .gz files
location ~* \.(js|css)$ {
  gzip_static on;  # prefer static .gz files
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

## HTTPS Configuration

```nginx
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;  # redirect HTTP to HTTPS
}

server {
  listen 443 ssl http2;  # enable HTTP/2
  server_name example.com;

  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  # Security configuration
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;

  # HSTS: force browsers to use HTTPS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  root /var/www/myapp/dist;
  # ... remaining config
}
```

## API Proxy

In a frontend/backend separation setup, directly requesting backend APIs from the frontend causes CORS issues. Solve it with an nginx proxy:

```nginx
server {
  # Frontend assets
  location / {
    root /var/www/frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  # Proxy API requests to the backend
  location /api/ {
    proxy_pass http://localhost:8080/;  # forward to backend service
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## Security Response Headers

```nginx
# Add inside server or http block
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'" always;
```

## Complete Configuration Example

```nginx
server {
  listen 443 ssl http2;
  server_name myapp.example.com;

  ssl_certificate /etc/ssl/cert.pem;
  ssl_certificate_key /etc/ssl/key.pem;

  root /var/www/myapp/dist;

  # Security headers
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;

  # index.html - no cache
  location = /index.html {
    add_header Cache-Control "no-cache";
  }

  # Hashed static assets - long-term cache
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    gzip_static on;
  }

  # Images
  location ~* \.(png|jpg|jpeg|gif|svg|ico|woff2)$ {
    add_header Cache-Control "public, max-age=2592000";
  }

  # SPA routing
  location / {
    try_files $uri $uri/ /index.html;
  }

  # API proxy
  location /api/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## Summary

- SPAs must configure `try_files ... /index.html`
- Don't cache HTML; cache hashed assets forever
- Enable gzip compression — JS typically compresses by 70%
- HTTPS + HTTP/2 is the modern baseline
