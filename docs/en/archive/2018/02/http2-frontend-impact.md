---
title: "The Real Impact of HTTP/2 on Frontend Resource Loading"
date: 2018-02-13 17:42:20
tags:
  - Frontend
readingTime: 3
description: "HTTP/2 has been around for a few years, but many frontend developers still aren't sure what it actually changed or how it affects frontend optimization strategi"
---

HTTP/2 has been around for a few years, but many frontend developers still aren't sure what it actually changed or how it affects frontend optimization strategies. This article covers the practical differences.

## The Main Bottleneck of HTTP/1.1

In the HTTP/1.1 era, browsers limited the number of concurrent requests to the same domain (typically 6). This caused a classic problem:

```
Resource 1 ──── waiting ──────── loading
Resource 2 ──── waiting ──────────── loading
Resource 3 ──── waiting ────────────── loading
Resource 4                 ─── waiting ──── loading
Resource 5                 ─── waiting ──────── loading
Resource 6                 ─── waiting ────────── loading
```

To work around this limit, we invented many "tricks":

- **Domain Sharding**: distribute resources across multiple subdomains
- **Image Sprites**: combine multiple small images into one large image
- **File Concatenation**: merge multiple JS/CSS files into one big file

## HTTP/2 Multiplexing

The core improvement in HTTP/2 is **Multiplexing**: a single TCP connection can simultaneously transmit multiple requests and responses — no more concurrency limits.

```
HTTP/1.1                    HTTP/2

Request1  ───────── Response1      Request1 ─┐ Response1 ─┐
waiting...                         Request2  ├──────      ├── simultaneously
Request2  ───────── Response2      Request3  ┘ Response2  │
waiting...                                    Response3 ─┘
Request3  ───────── Response3
```

## Impact on Frontend Optimization Strategies

### Domain Sharding Is No Longer Necessary

In HTTP/1.1, `cdn1.example.com` and `cdn2.example.com` helped bypass concurrency limits. Now they're actually harmful:

- HTTP/2 multiplexing works on a single connection
- Multiple domains = multiple TCP connections = more handshake overhead
- **Conclusion**: consolidating to one domain is better under HTTP/2

### File Concatenation Strategy Has Changed

HTTP/1.1: merge all JS into one large file to reduce request count
HTTP/2: request count is no longer the bottleneck, you can split files more granularly

```javascript
// HTTP/1.1 Webpack approach: minimize file count

// HTTP/2 era: split by module for fine-grained browser caching
optimization: {
  splitChunks: {
    cacheGroups: {
      vue: { test: /vue/, name: 'vue', chunks: 'all' },
      axios: { test: /axios/, name: 'axios', chunks: 'all' },
      elementUI: { test: /element-ui/, name: 'element-ui', chunks: 'all' }
    }
  }
}
```

The benefit of fine-grained splitting: if the `vue` version hasn't changed, users visiting a new version won't need to re-download `vue.js`.

### Server Push

HTTP/2 supports the server proactively pushing resources:

```
Browser: requests index.html
Server: here's index.html, and here's main.css and main.js too (you'll need them soon)
Browser: (main.css and main.js are already local, no additional requests needed)
```

Nginx Server Push configuration:

```nginx
location = /index.html {
  http2_push /static/main.css;
  http2_push /static/main.js;
}
```

### Image Sprites Still Have Value (in Some Cases)

While HTTP/2 solves the concurrent request problem, having every small icon as a separate file still incurs some overhead. **Icon fonts or SVG sprites are still better icon solutions** — not because of request count, but because of controllability and maintainability.

## Check If Your Site Uses HTTP/2

In Chrome DevTools Network panel, right-click the header row and enable the "Protocol" column:

- `h2` = HTTP/2
- `http/1.1` = HTTP/1.1

If your server hasn't upgraded to HTTP/2, here's the Nginx configuration:

```nginx
server {
  listen 443 ssl http2;          # Key: add http2
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  # HTTP/2 requires HTTPS, so ensure HTTPS is configured correctly first
}
```

## Benchmark Data (For Reference)

Comparison on our admin dashboard project (~30 JS/CSS files):

| Scenario             | First Load Time |
| -------------------- | --------------- |
| HTTP/1.1             | 2.8s            |
| HTTP/2               | 1.6s            |
| HTTP/2 + Server Push | 1.2s            |

Results vary significantly by network conditions, but HTTP/2 improvements are usually noticeable.

## Summary

- HTTP/2 multiplexing solves concurrency limits — many HTTP/1.1 "optimization tricks" are no longer necessary
- Domain sharding is actually harmful; consolidating to one domain is better
- Files can be split more granularly to improve cache utilization
- Server Push is an additional win but requires server-side support
- Upgrading to HTTP/2 requires HTTPS first
