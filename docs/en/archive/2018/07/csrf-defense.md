---
title: "CSRF Attack and Defense Practices"
date: 2018-07-09 17:42:13
tags:
  - Security
readingTime: 2
description: "I wrote about XSS defense before; this time let's talk about CSRF. They are often mentioned together, but the underlying principles are completely different."
wordCount: 250
---

I wrote about XSS defense before; this time let's talk about CSRF. They are often mentioned together, but the underlying principles are completely different.

## What is CSRF

CSRF (Cross-Site Request Forgery): an attacker tricks a logged-in user into visiting a malicious page, which then makes requests on the user's behalf.

```
Normal flow: User → logs into bank website (gets cookie) → transfers money

CSRF attack:
User → logs into bank (has cookie)
     → visits attacker's page (contains <img src="https://bank.com/transfer?to=hacker&amount=10000">)
     → browser automatically sends the request with the bank's cookie
     → bank executes the transfer!
```

Key point: the browser automatically includes the target domain's cookie when making requests — the attacker never needs to know the cookie value.

## Defense Strategies

### 1. CSRF Token (Most Common)

The server generates a random token, embeds it in forms/request headers, and the attacker cannot forge it:

```javascript
// Server: generate token and store in session
const csrfToken = crypto.randomBytes(32).toString("hex");
req.session.csrfToken = csrfToken;

// Return it to the frontend (in a response header or meta tag)
res.setHeader("X-CSRF-Token", csrfToken);
```

```javascript
// Frontend: include the token in every request
// axios global config
axios.interceptors.request.use((config) => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  if (token) {
    config.headers["X-CSRF-Token"] = token;
  }
  return config;
});
```

```javascript
// Server: validate the token
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next(); // read-only requests don't need validation
  }

  const token = req.headers["x-csrf-token"];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }
  next();
});
```

### 2. SameSite Cookie

Modern browsers support the `SameSite` attribute to control whether cookies are sent with cross-site requests:

```
Set-Cookie: session=xxx; SameSite=Strict; HttpOnly; Secure
```

- `Strict`: cookies are never sent with cross-site requests
- `Lax`: allows cross-site navigation (link clicks), not form/fetch requests (Chrome 80+ default)
- `None`: allows cross-site (must also set Secure)

```javascript
// Express cookie settings
res.cookie("sessionId", token, {
  httpOnly: true,
  secure: true,
  sameSite: "lax", // recommend "strict" in production
});
```

### 3. Referer/Origin Validation

Check the request's origin domain:

```javascript
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !origin.startsWith("https://yourdomain.com")) {
    return res.status(403).json({ error: "Invalid origin" });
  }
  next();
});
```

Downside: the Referer header may be stripped by users or proxies, making this unreliable on its own.

## CSRF vs XSS

|              | CSRF                      | XSS                                      |
| ------------ | ------------------------- | ---------------------------------------- |
| Exploits     | User's identity (cookie)  | Browser executing attacker's code        |
| Attacker can | Make requests as the user | Read cookies, alter pages, send requests |
| Core defense | Token + SameSite Cookie   | CSP + input escaping                     |

## Summary

- CSRF exploits the browser's automatic cookie behavior to make requests without the user's knowledge
- CSRF Token is the most universal defense
- `SameSite: Lax/Strict` is an effective defense in modern browsers
- GET requests should have no side effects (otherwise an img src can be used to attack)
