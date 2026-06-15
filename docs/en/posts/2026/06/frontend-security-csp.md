---
title: "Frontend Security 2026: CSP v3 and Subresource Integrity"
date: 2026-06-15 14:39:35
tags:
  - Security
readingTime: 1
description: "Content Security Policy v3 and Subresource Integrity are the two pillars of 2026 frontend security. This article discusses CSP configuration strategies, SRI usage methods, and common security pitfalls."
wordCount: 142
---

Frontend security is no longer an "optional add-on" but a core part of application architecture. The 2026 web security environment is more complex, and CSP v3 and SRI provide standardized protection mechanisms.

## Content Security Policy Basics

CSP controls resource loading via HTTP headers or meta tags:

```html
<!-- HTTP header -->
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123'

<!-- meta tag -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'nonce-abc123'">
```

## CSP v3 New Features

```html
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-abc123' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

Key improvements:
- **`strict-dynamic`**: Trusts scripts loaded by existing scripts
- **`frame-ancestors`**: Replaces `X-Frame-Options`
- **`base-uri`**: Prevents `<base>` tag hijacking
- **`form-action`**: Limits form submission targets

## Nonce Generation and Usage

```typescript
// Server-side nonce generation
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// Middleware adds CSP header
app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
  `);
  
  next();
});
```

## Subresource Integrity

SRI ensures external resources aren't tampered with:

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

## Common Security Pitfalls

**Pitfall 1: `unsafe-inline` risk**

```html
<!-- Dangerous: allows arbitrary inline scripts -->
Content-Security-Policy: script-src 'self' 'unsafe-inline'

<!-- Safe: use nonce -->
Content-Security-Policy: script-src 'self' 'nonce-abc123'
```

**Pitfall 2: `unsafe-eval` risk**

```html
<!-- Dangerous: allows eval -->
Content-Security-Policy: script-src 'self' 'unsafe-eval'

<!-- Safe: avoid eval -->
Content-Security-Policy: script-src 'self'
```

## Progressive Deployment

```html
<!-- Phase 1: report only -->
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report

<!-- Phase 2: lenient policy -->
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval'

<!-- Phase 3: strict policy -->
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xxx'
```

## Summary

CSP v3 and SRI are the foundation of 2026 frontend security. CSP controls resource loading sources, SRI ensures resource integrity. Deployment should be progressive—start with Report-Only to collect data, then gradually tighten policies. Security is not a one-time job but a continuous process.
