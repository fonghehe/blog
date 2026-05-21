---
title: "Common Nginx Configurations for Frontend Deployment"
date: 2018-12-06 10:15:04
tags:
  - Engineering
readingTime: 1
description: "When deploying frontend projects on Nginx, I always had to hunt for the right configs. Here's a reference collection of the ones I use most."
wordCount: 95
---

When deploying frontend projects on Nginx, I always had to hunt for the right configs. Here's a reference collection of the ones I use most.

## Basic Config: Single-Page Applications

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/dist;
    index index.html;

    # The key SPA config: return index.html for all paths
    # Required for Vue Router history mode
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets: long-term cache
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML files: no cache (always fetch the latest entry file)
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

## HTTPS Configuration

```nginx
server {
    listen 80;
    server_name example.com;
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/ssl/example.com.crt;
    ssl_certificate_key /etc/ssl/example.com.key;

    # Security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # HSTS (enforce HTTPS)
    add_header Strict-Transport-Security "max-age=31536000" always;

    root /var/www/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Reverse Proxy: Frontend Calling Backend API

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy /api requests to the backend service
    location /api/ {
        proxy_pass http://localhost:3000/;  # trailing slash strips the /api prefix

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout settings
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }
}
```

## Gzip Compression

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;    # Don't compress files smaller than 1KB
    gzip_comp_level 6;       # Level 1-9; 6 is the sweet spot
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

## Static Asset Cache Strategy

```nginx
# Optimal cache strategy paired with webpack contenthash:
# - HTML entry file: no cache, always fetch latest
# - JS/CSS (with hash): permanent cache, since hash changes when content changes

location = /index.html {
    add_header Cache-Control "no-cache";
}

location ~* \.[0-9a-f]{8}\.(js|css)$ {
    # Hashed files: cache permanently
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Security Response Headers

```nginx
server {
    add_header X-Frame-Options SAMEORIGIN;           # Prevent clickjacking
    add_header X-Content-Type-Options nosniff;       # Prevent MIME sniffing
    add_header X-XSS-Protection "1; mode=block";     # XSS filter
    add_header Referrer-Policy "same-origin";
}
```

## Summary

- SPA: `try_files $uri $uri/ /index.html` enables history-mode routing
- Caching: hash + permanent cache for JS/CSS; no cache for HTML
- Reverse proxy: `proxy_pass` forwards `/api` to the backend
- Gzip: configure `gzip_types` for the MIME types you want to compress
- HTTPS: redirect HTTP to HTTPS and add the HSTS header
