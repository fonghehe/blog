---
title: "Nginx Frontend Cache Strategy Configuration in Practice"
date: 2019-06-17 17:13:38
tags:
  - Engineering
readingTime: 1
description: "Frontend performance optimization often starts with compression and code splitting, but browser caching is another high-leverage area. A proper Nginx caching co"
---

Frontend performance optimization often starts with compression and code splitting, but browser caching is another high-leverage area. A proper Nginx caching configuration can dramatically reduce server pressure and significantly improve repeat-visit load times.

## Browser Caching Fundamentals

The browser cache decision flow:

```
Request resource
     ↓
Has local cache?
  ├── No → fetch from server
  └── Yes
        ↓
     Cache expired?
       ├── No → use local cache (200 from cache)
       └── Yes
             ↓
          Send conditional request (If-None-Match / If-Modified-Since)
            ├── Server: not modified → 304 Not Modified (use cache)
            └── Server: changed → 200 + new resource
```

## Nginx expires Directive

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/html;

    # HTML: no cache (always fetch fresh)
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
    }

    # Hashed static assets: permanent cache (Webpack hash ensures uniqueness)
    # e.g. main.a1b2c3d4.js, app.5e6f7g8h.css
    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Images: longer cache
    location ~* \.(png|jpg|jpeg|gif|webp|svg|ico)$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # Fonts: permanent cache
    location ~* \.(woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }
}
```

## Fine-Grained Cache-Control

```nginx
# Cache-Control header reference:
# public   — can be cached by any middleware/proxy
# private  — only the user's browser can cache (not proxies)
# no-cache — must revalidate with server before using cache
# no-store — must not store any cache
# max-age  — seconds until expiration
# immutable — file content never changes, no need to revalidate

# API responses: no cache (dynamic data)
location /api/ {
    proxy_pass http://backend;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Vary "Authorization";  # different cache per user
}
```

## Practical Frontend Build Strategy

Combine with Webpack content hash for maximum efficiency:

```
dist/
├── index.html          → no-cache (re-fetch every time)
├── js/
│   ├── app.a1b2c3.js   → 1-year cache (hash changes when content changes)
│   └── vendor.d4e5f6.js → 1-year cache
└── css/
    └── app.g7h8i9.css   → 1-year cache
```

The core strategy: **HTML never caches; everything else caches by hash**.
