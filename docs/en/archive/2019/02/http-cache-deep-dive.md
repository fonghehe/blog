---
title: "A Deep Dive into HTTP Caching: Strong Cache vs. Negotiated Cache"
date: 2019-02-23 10:46:09
tags:
  - Frontend
readingTime: 1
description: "HTTP caching is a key part of frontend performance optimization, but many developers are unclear about the difference between strong caching and negotiated cach"
wordCount: 72
---

HTTP caching is a key part of frontend performance optimization, but many developers are unclear about the difference between strong caching and negotiated caching, leading to caches that either don't take effect or updates that are delayed.

## Caching Flow

```
Request a resource
  ↓
Does the browser have a cache?
  → No: request the server directly
  → Yes: check the strong cache (Cache-Control / Expires)
       → Not expired: use the cache (200 from cache)
       → Expired: negotiated cache (send If-None-Match / If-Modified-Since)
                 → Server returns 304: use the local cache
                 → Server returns 200: use the new resource
```

## Strong Cache

```http
# Response headers
Cache-Control: max-age=31536000  # cache for 1 year (in seconds)
Cache-Control: no-cache          # do not use strong cache (still negotiates)
Cache-Control: no-store          # do not cache at all
Cache-Control: private           # browser-only cache, not CDN
Cache-Control: public            # can be cached by CDN
Expires: Wed, 23 Feb 2020 00:00:00 GMT  # legacy; uses server time
```

`Cache-Control` takes priority over `Expires`. Use `Cache-Control` in modern projects.

## Negotiated Cache

```http
# Response headers (first request)
ETag: "abc123"                         # unique resource identifier (content hash)
Last-Modified: Tue, 22 Feb 2019 10:00:00 GMT

# Request headers (subsequent request, after strong cache expires)
If-None-Match: "abc123"               # the ETag from last time
If-Modified-Since: Tue, 22 Feb 2019 10:00:00 GMT

# Server response: no change
HTTP/1.1 304 Not Modified             # browser uses local cache
# Server response: changed
HTTP/1.1 200 OK + new resource
```

`ETag` is more precise (content-level), while `Last-Modified` has second-level precision. Use ETag.

## Static Asset Caching Strategy

```nginx
# nginx configuration example

# HTML: no caching (use negotiated cache to ensure the latest entry file)
location ~* \.html$ {
  add_header Cache-Control "no-cache";
  add_header ETag "";
}

# Hashed JS/CSS: long-term caching
# (content changes → hash changes → filename changes → automatic update)
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# Images: 1 month
location ~* \.(jpg|png|gif|webp|svg)$ {
  add_header Cache-Control "public, max-age=2592000";
}

# Fonts: 1 year
location ~* \.(woff2|woff|ttf)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

## Webpack Hash Configuration

```javascript
// webpack.config.js (production)
module.exports = {
  output: {
    filename: "[name].[contenthash:8].js", // content hash
    chunkFilename: "[name].[contenthash:8].chunk.js",
  },
  optimization: {
    // Keep vendor hash stable (only changes when dependencies change)
    moduleIds: "hashed",
    runtimeChunk: "single", // separate runtime chunk to avoid affecting other chunk hashes
    splitChunks: {
      cacheGroups: {
        vendor: {
```
