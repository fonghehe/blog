---
title: "Frontend Security 2026: CSP Level 3 and Trusted Types Implementation"
date: 2026-06-19 12:56:59
tags:
  - Security
readingTime: 3
description: "XSS attacks remain the biggest threat to frontend security. This article systematically covers CSP Level 3 and Trusted Types application in real projects for building more secure frontend applications."
wordCount: 223
---

XSS (Cross-Site Scripting) is a long-standing security threat in OWASP Top 10. In 2026, CSP Level 3 and Trusted Types have become core technologies for defending against XSS. Understanding their principles and practical methods is an essential skill for every frontend developer.

## XSS Attack Essence

The core of XSS attacks is that attackers can inject and execute malicious scripts into pages:

```html
<!-- Reflected XSS -->
<img src="x" onerror="alert('XSS')">

<!-- Stored XSS -->
<div class="comment">
  <script>stealCookies()</script>
</div>

<!-- DOM-based XSS -->
<script>
  document.getElementById('output').innerHTML = location.hash.slice(1)
</script>
```

Traditional XSS defense methods (input filtering, output encoding) are effective but error-prone. CSP and Trusted Types provide more reliable defense mechanisms.

## CSP Level 3 Basics

Content Security Policy (CSP) defends against XSS by limiting resources that pages can load and execute:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-random123';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
">
```

### Nonce and Hash

Nonce (number used once) and Hash are the most secure script loading methods in CSP:

```html
<!-- Nonce method -->
<script nonce="random123">
  // Only scripts with correct nonce can execute
  console.log('This script is allowed')
</script>

<!-- Hash method -->
<script sha256="base64EncodedHash">
  // Script content hash must match
</script>
```

```javascript
// Server-side nonce generation
import crypto from 'crypto'

function generateNonce() {
  return crypto.randomBytes(16).toString('base64')
}

// Set CSP header
app.use((req, res, next) => {
  const nonce = generateNonce()
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'unsafe-inline';
  `)
  res.locals.nonce = nonce
  next()
})
```

## Trusted Types Detailed

Trusted Types is Google's DOM XSS defense solution that forces all DOM operations to use type-safe APIs:

```html
<meta http-equiv="Content-Security-Policy" content="
  trusted-types default;
">
```

### Basic Usage

```javascript
// Disable direct innerHTML usage
element.innerHTML = userInput  // ❌ Violates CSP

// Must use TrustedHTML
const trustedHTML = trustedTypes.createPolicy('default', {
  createHTML: (input) => {
    // Sanitize input
    return DOMPurify.sanitize(input)
  }
})

element.innerHTML = trustedHTML.createHTML(userInput)  // ✅ Allowed
```

### Creating Custom Policies

```javascript
// Define multiple policies, each responsible for different sanitization logic
const htmlPolicy = trustedTypes.createPolicy('htmlPolicy', {
  createHTML: (input) => {
    // Allowed HTML tag whitelist
    const allowedTags = ['b', 'i', 'em', 'strong', 'a', 'p']
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: ['href', 'title']
    })
  }
})

const scriptURLPolicy = trustedTypes.createPolicy('scriptURLPolicy', {
  createScriptURL: (input) => {
    // Only allow scripts from specific domains
    const allowedDomains = ['cdn.example.com', 'self']
    const url = new URL(input, location.origin)
    
    if (allowedDomains.includes(url.hostname) || input.startsWith('/')) {
      return url
    }
    
    throw new Error(`Disallowed script source: ${input}`)
  }
})
```

## Real Project Application

### React/Vue Project Configuration

```javascript
// React project: configure CSP
// index.html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.example.com;
">

// React component using Trusted Types
import { useEffect } from 'react'

function UserContent({ html }) {
  const containerRef = useRef(null)
  
  useEffect(() => {
    if (containerRef.current) {
      const policy = trustedTypes.createPolicy('react-content', {
        createHTML: (input) => DOMPurify.sanitize(input)
      })
      
      containerRef.current.innerHTML = policy.createHTML(html)
    }
  }, [html])
  
  return <div ref={containerRef} />
}
```

### Express Middleware

```javascript
import crypto from 'crypto'
import helmet from 'helmet'

app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.locals.nonce = nonce
  
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://api.example.com;
    font-src 'self' https://fonts.gstatic.com;
    frame-src 'self' https://www.youtube.com;
    trusted-types default htmlPolicy purify;
  `)
  
  next()
})
```

## Progressive Migration Strategy

For existing projects, progressive migration is recommended:

```javascript
// Step 1: Report only, don't block
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  report-uri /csp-report;
">

// Step 2: Add common directives
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  report-uri /csp-report;
">

// Step 3: Enable Trusted Types
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self' 'unsafe-inline';
  trusted-types default;
  report-uri /csp-report;
">

// Step 4: Strict mode
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  trusted-types default;
  require-trusted-types-for 'script';
">
```

## Summary

CSP Level 3 and Trusted Types are cornerstones of modern frontend security. CSP defends against XSS by limiting resource sources, while Trusted Types prevent DOM injection attacks through type-safe APIs. In real projects, progressive migration is recommended: start by reporting violations, then gradually enable strict policies. Combined with Nonce, Hash, and DOMPurify, you can build truly secure frontend applications.
