---
title: "HTTP Caching: Strong Cache vs Negotiated Cache"
date: 2018-04-25 16:13:17
tags:
  - Frontend
readingTime: 2
description: "Correctly configuring HTTP caching can significantly improve page load performance, but misconfiguration can prevent users from seeing the latest content. You n"
---

Correctly configuring HTTP caching can significantly improve page load performance, but misconfiguration can prevent users from seeing the latest content. You need to understand the mechanics to make good decisions.

## Two Types of Caching

```
Browser makes a request
    ↓
Is there a cached version? → No → Request from server → Store cache → Return
    ↓ Yes
Is the strong cache valid? → Yes → Use cache directly (no server request) 200 from cache
    ↓ No
Send negotiation request to server → Unchanged → 304 Not Modified, use cache
                                   → Changed   → 200, new content
```

## Strong Cache

The browser checks if its cache is still valid — if it is, the cache is used directly with **no request to the server**.

### Cache-Control (HTTP/1.1, takes priority)

```
# Server response header
Cache-Control: max-age=31536000   # cache for 1 year (in seconds)
Cache-Control: no-cache           # skip strong cache, but allow negotiated cache
Cache-Control: no-store           # no caching at all
Cache-Control: private            # only the browser can cache, CDNs cannot
Cache-Control: public             # both browser and CDN can cache
```

### Expires (HTTP/1.0, lower priority)

```
Expires: Thu, 01 Jan 2019 00:00:00 GMT   # expiry date (absolute time)
```

Drawback: depends on the client clock — if the client time is off, this breaks. Superseded by `Cache-Control`.

## Negotiated Cache

The browser sends a cache identifier to the server, and the server decides whether the resource has changed.

### Last-Modified / If-Modified-Since

```
# First request — server response
Last-Modified: Mon, 01 Jan 2018 10:00:00 GMT

# Subsequent requests — browser sends
If-Modified-Since: Mon, 01 Jan 2018 10:00:00 GMT

# Server decides: resource unchanged
HTTP/1.1 304 Not Modified

# Server decides: resource changed
HTTP/1.1 200 OK
Last-Modified: Mon, 15 Jan 2018 09:30:00 GMT
[new content]
```

**Drawback**: precision is only one second — multiple changes within one second are undetected.

### ETag / If-None-Match (More Accurate)

```
# First request — server response
ETag: "abc123"  # hash of the content

# Subsequent requests
If-None-Match: "abc123"

# Server compares ETag
HTTP/1.1 304 Not Modified  # or 200 + new ETag
```

ETag is a content digest — if the content changes, the ETag changes. More accurate than `Last-Modified`.

## Best Caching Strategy for Frontend Assets

### HTML Files: No Cache or Negotiated Cache

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache";
}
```

Reason: HTML is the entry point and must be updated promptly, so users always get the latest JS/CSS filenames.

### Hashed JS/CSS: Maximize Strong Cache

```nginx
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

Webpack builds files with content hashes in their names:

```javascript
// webpack.config.js
output: {
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

This means `app.a1b2c3d4.js` keeps its hash (and cache) as long as the content doesn't change — and when it does, the filename changes (automatically invalidating the cache). You can safely set a 1-year strong cache.

### Images and Fonts

```nginx
location ~* \.(jpg|jpeg|png|gif|svg|woff2|ttf)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30 days
}
```

## Correct Vue CLI / Webpack Configuration

```javascript
// vue.config.js
module.exports = {
  filenameHashing: true, // file name hashing is on by default

  chainWebpack: (config) => {
    // Ensure index.html is not cached
    config.plugin("html").tap((args) => {
      args[0].cache = false;
      return args;
    });
  },
};
```

## Verifying Cache Behavior

Chrome DevTools → Network panel:

- `200 (from memory cache)` — strong cache (memory)
- `200 (from disk cache)` — strong cache (disk)
- `304 Not Modified` — negotiated cache hit
- `200` — cache miss, fetched from server

**Size column showing 0** means the cache was used — no actual data was transferred.

## Summary

- Don't use strong cache for HTML; use `no-cache` to ensure each visit is validated
- Use content-hashed filenames for JS/CSS — safe to set maximum strong cache
- Negotiated cache with ETag is more accurate than `Last-Modified`
- Webpack's `contenthash` is the key to correct cache invalidation
