---
title: "Nginx Frontend Configuration Complete Guide"
date: 2019-03-28 11:14:57
tags:
  - Engineering
readingTime: 1
description: "Frontend engineers who don't understand Nginx configuration can't resolve many deployment issues on their own. Here's a practical configuration reference."
---

Frontend engineers who don't understand Nginx configuration can't resolve many deployment issues on their own. Here's a practical configuration reference.

## Basics: SPA Routing Support

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/html;
  index index.html;

  # SPA routing: all paths return index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Without this, refreshing a page with vue-router history mode will return a 404.

## HTTPS Configuration

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;

  ssl_certificate     /etc/ssl/certs/example.com.pem;
  ssl_certificate_key /etc/ssl/private/example.com.key;

  # SSL performance optimizations
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
  ssl_prefer_server_ciphers off;

  # HSTS (tell the browser to always use HTTPS)
  add_header Strict-Transport-Security "max-age=63072000" always;
}

# Redirect HTTP to HTTPS
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;
}
```

## Static Asset Caching

```nginx
server {
  # HTML: no caching
  location ~* \.html$ {
    add_header Cache-Control "no-cache, must-revalidate";
  }

  # Hashed JS/CSS: long-term caching
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # Images/fonts
  location ~* \.(jpg|jpeg|png|webp|gif|ico|svg|woff2|woff|ttf)$ {
    add_header Cache-Control "public, max-age=2592000";
    add_header Vary "Accept-Encoding";
  }
}
```

## Gzip Compression

```nginx
http {
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_proxied expired no-cache no-store private auth;
  gzip_types
    text/plain
    text/css
    text/javascript
    application/javascript
    application/json
    application/xml
    image/svg+xml;
  gzip_comp_level 6;
}
```

You can pre-generate `.gz` files during the Webpack build (`compression-webpack-plugin`), and Nginx will serve them directly.
