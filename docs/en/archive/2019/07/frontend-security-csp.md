---
title: "Frontend Security: Content Security Policy (CSP)"
date: 2019-07-04 14:30:53
tags:
  - Security
readingTime: 2
description: "Frontend security is something every developer should take seriously. XSS attacks are hard to prevent — relying solely on filtering user input is never foolproo"
wordCount: 298
---

Frontend security is something every developer should take seriously. XSS attacks are hard to prevent — relying solely on filtering user input is never foolproof. CSP (Content Security Policy) provides a browser-level mechanism to restrict resource loading and script execution, making it an important complement to XSS defense.

## What is CSP?

CSP is an HTTP response header that tells the browser which resources can be loaded and which cannot. Even if an attacker successfully injects malicious scripts, CSP can prevent the browser from executing them.

The most basic CSP header looks like this:

```
Content-Security-Policy: default-src 'self'
```

This means: all resources (scripts, styles, images, fonts, etc.) can only be loaded from the same origin.

## Configuration Methods

### Method 1: HTTP Response Header (Recommended)

Nginx configuration:

```nginx
server {
    listen 80;
    server_name example.com;

    add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self' https://cdn.jsdelivr.net;
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: https:;
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self' https://api.example.com;
        frame-ancestors 'none';
        base-uri 'self';
        form-action 'self';
    ";
}
```

Express configuration:

```javascript
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'",
  );
  next();
});
```

### Method 2: meta Tag

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'"
/>
```

Note: The `meta` tag approach doesn't support `report-uri`, `frame-ancestors`, and other directives, so HTTP headers are recommended for production.

## Common Directives

| Directive         | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| `default-src`     | Default policy for all resource types                     |
| `script-src`      | JavaScript scripts                                        |
| `style-src`       | CSS stylesheets                                           |
| `img-src`         | Images                                                    |
| `font-src`        | Font files                                                |
| `connect-src`     | fetch, XHR, WebSocket, etc.                               |
| `frame-src`       | iframe loading                                            |
| `media-src`       | Audio and video                                           |
| `object-src`      | `<object>`, `<embed>`                                     |
| `base-uri`        | `<base>` tag                                              |
| `form-action`     | Form submission targets                                   |
| `frame-ancestors` | Who can embed the current page (replaces X-Frame-Options) |

## Nonce Strategy: Solving the Inline Script Problem

Many projects (especially those using Webpack) generate inline scripts. CSP blocks all inline scripts by default, unless you use `'unsafe-inline'` — but this reopens the security gate.

A better approach is **nonce** (a one-time random number):

```
Content-Security-Policy: script-src 'nonce-random123abc'
```

```html
<!-- This will execute -->
<script nonce="random123abc">
  console.log("Secure inline script");
</script>

<!-- This will be blocked -->
<script>
  alert("Malicious script");
</script>
```

Node.js implementation:

```javascript
const crypto = require("crypto");

app.use((req, res, next) => {
  // Generate a random nonce per request
  const nonce = crypto.randomBytes(16).toString("base64");

  // Set CSP header
  res.setHeader(
    "Content-Security-Policy",
    `script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'`,
  );

  // Pass nonce to template
  res.locals.nonce = nonce;
  next();
});
```

## report-uri: Monitor Violations

Configure `report-uri` to have the browser automatically report CSP violations:

```
Content-Security-Policy: default-src 'self'; report-uri /csp-report
```

```javascript
// Backend: receive violation reports
app.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  (req, res) => {
    const report = req.body["csp-report"];
    console.error("CSP Violation:", {
      blockedUri: report["blocked-uri"],
      violatedDirective: report["violated-directive"],
      documentUri: report["document-uri"],
    });
    res.status(204).end();
  },
);
```

## Summary

- CSP prevents malicious scripts from executing even after injection
- Use HTTP headers (not meta tags) in production
- Use `nonce` instead of `'unsafe-inline'` for inline scripts
- `report-uri` helps monitor and debug violations
- Start with `Content-Security-Policy-Report-Only` during migration to avoid breaking existing functionality
