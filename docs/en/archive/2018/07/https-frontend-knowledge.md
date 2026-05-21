---
title: "How HTTPS Works and What Frontend Developers Need to Know"
date: 2018-07-31 14:48:32
tags:
  - HTTP
readingTime: 1
description: "HTTPS is standard in modern web development, but how does it actually work? And what does it mean for frontend developers? Let me summarize."
wordCount: 130
---

HTTPS is standard in modern web development, but how does it actually work? And what does it mean for frontend developers? Let me summarize.

## HTTP vs HTTPS

```
HTTP: plaintext transmission — a man-in-the-middle can see and modify everything

HTTPS = HTTP + TLS (Transport Layer Security)
  - Encryption: data is unreadable to intermediaries
  - Authentication: confirms you're connecting to the real server, not an impersonator
  - Integrity: data wasn't tampered with in transit
```

## TLS Handshake (Simplified)

```
1. Client → Server: supported TLS versions, list of cipher suites
2. Server → Client: chosen cipher suite + digital certificate (with public key)
3. Client: verifies certificate validity (CA signature)
4. Client → Server: encrypts a random number with the public key
5. Both sides: derive a symmetric encryption key from the random number
6. Subsequent communication: encrypted with the symmetric key (fast)
```

## Digital Certificates

```
A certificate contains:
  - Domain name (your website address)
  - Public key
  - Issuing authority (CA)
  - Expiration date
  - CA's digital signature

Browser verifies the certificate:
  1. Does the domain match the one being visited?
  2. Is it expired?
  3. Is the CA signature valid (was it issued by a trusted CA)?
```

## HTTPS Issues in Frontend Development

**Mixed Content**

```html
<!-- Loading HTTP resources from an HTTPS page → blocked by browser -->
<img src="http://example.com/image.jpg" />
<!-- blocked -->
<script src="http://cdn.com/lib.js"></script>
<!-- blocked -->

<!-- Fix: use HTTPS or protocol-relative URLs -->
<img src="https://example.com/image.jpg" />
<img src="//example.com/image.jpg" />
<!-- protocol-relative: automatically uses current page's protocol -->
```

**HTTPS in Local Development**

```bash
# Use mkcert to create a locally trusted certificate (no --ignore-certificate-errors needed)
mkcert -install
mkcert localhost 127.0.0.1

# webpack devServer config
devServer: {
  https: {
    key: fs.readFileSync('./localhost-key.pem'),
    cert: fs.readFileSync('./localhost.pem')
  }
}
```

**Secure Cookie**

```javascript
// This cookie is only sent over HTTPS
document.cookie = "token=xxx; Secure; HttpOnly";
```

## HSTS (HTTP Strict Transport Security)

```
The server tells the browser: always use HTTPS for me from now on, never HTTP

Response header:
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

The browser remembers this directive, so even if a user types `http://example.com`, it automatically upgrades to HTTPS.

## Certificate Types

```
DV (Domain Validation): only verifies domain ownership, takes minutes, free
  - Let's Encrypt is this type
  - Good for personal websites, blogs

OV (Organization Validation): verifies domain + organization info, takes a few days
  - Shows company name, good for business websites

EV (Extended Validation): most rigorous, takes 1-2 weeks
  - Browser address bar shows green company name (most browsers have removed this)
  - Used by banks, large e-commerce sites
```

## Summary

- HTTPS = HTTP + TLS: provides encryption, authentication, and integrity
- TLS handshake: asymmetric encryption to exchange keys, then symmetric encryption for communication
- Mixed content: all resources on an HTTPS page must also be HTTPS
- Local development: use mkcert to generate trusted certificates and avoid certificate warnings
- Let's Encrypt provides free DV certificates — there's no reason not to use HTTPS
