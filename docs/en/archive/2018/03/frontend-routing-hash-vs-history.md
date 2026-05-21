---
title: "Frontend Routing Principles: Hash Mode vs History Mode"
date: 2018-03-20 14:39:59
tags:
  - Frontend
readingTime: 2
description: "Every project using Vue Router has to choose between two modes, but many people don't understand why both exist or what the difference is. This article starts f"
wordCount: 338
---

Every project using Vue Router has to choose between two modes, but many people don't understand why both exist or what the difference is. This article starts from the principles.

## Why Frontend Routing

Traditional multi-page apps: every navigation sends a request to the server for a new page, with a full page refresh.

Single Page Applications (SPAs): only load the HTML once; subsequent page switches happen on the client without requesting a new page from the server.

The question: how do you change the browser URL without triggering a page refresh? That's what frontend routing answers.

## Hash Mode

Leverages the `#` anchor (hash) portion of the URL. How browsers handle hash changes:

1. When the part after `#` in the URL changes, **no request is sent to the server**
2. The `hashchange` event fires
3. The entry is added to browser history (can go back/forward)

```javascript
// Listen for hash changes
window.addEventListener("hashchange", (event) => {
  const newHash = location.hash; // '#/about'
  const path = newHash.slice(1); // '/about'
  renderRoute(path);
});

// Navigate: modify the hash
location.hash = "#/about"; // triggers hashchange but no page refresh
```

**What Hash mode URLs look like:**

```
http://example.com/#/
http://example.com/#/about
http://example.com/#/users/123
```

## History Mode

Uses the HTML5 History API:

```javascript
// pushState: add history entry, update URL, no page refresh
history.pushState({ page: 1 }, "title", "/about");

// replaceState: replace the current history entry
history.replaceState({ page: 1 }, "title", "/about");

// Listen for back/forward navigation
window.addEventListener("popstate", (event) => {
  const path = location.pathname; // '/about'
  renderRoute(path);
});
```

**What History mode URLs look like:**

```
http://example.com/
http://example.com/about
http://example.com/users/123
```

Cleaner URLs — no `#`.

## Core Differences

| Feature        | Hash Mode                        | History Mode |
| -------------- | -------------------------------- | ------------ |
| URL appearance | Has `#`                          | Clean        |
| Server config  | Not needed                       | Required     |
| Compatibility  | Better (IE8+)                    | IE10+        |
| SEO            | Fair (content after `#` debated) | Better       |

## History Mode Requires Server Configuration

This is the biggest pitfall of History mode.

When a user directly visits `http://example.com/users/123`, the server tries to find the file at `/users/123`. If it doesn't exist, it returns 404.

Solution: **configure the server to return `index.html` for all paths**, letting the frontend router handle them.

**Nginx configuration:**

```nginx
server {
  listen 80;
  root /var/www/myapp;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;  # return index.html if file not found
  }
}
```

**Apache .htaccess:**

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Development environment (webpack-dev-server):**

```javascript
devServer: {
  historyApiFallback: true; // handles automatically
}
```

## Vue Router Configuration

```javascript
const router = new VueRouter({
  mode: 'history',  // 'hash' is the default
  routes: [...]
})
```

## Implement a Simple Hash Router

The best way to understand the principle is to build it yourself:

```javascript
class HashRouter {
  constructor(routes) {
    this.routes = routes;
    this.currentPath = location.hash.slice(1) || "/";

    window.addEventListener("hashchange", () => {
      this.currentPath = location.hash.slice(1);
      this.render();
    });

    window.addEventListener("load", () => this.render());
  }

  push(path) {
    location.hash = path;
  }

  render() {
    const route = this.routes.find((r) => r.path === this.currentPath);
    if (route) {
      document.getElementById("app").innerHTML = route.component();
    }
  }
}

// Usage
const router = new HashRouter([
  { path: "/", component: () => "<h1>Home</h1>" },
  { path: "/about", component: () => "<h1>About</h1>" },
]);

router.push("/about");
```

## Which to Choose

- **Most projects**: History mode — cleaner URLs and better SEO, but remember to configure the server
- **Legacy browser support needed**: Hash mode
- **Pure static deployment** (GitHub Pages, etc.): Hash mode (can't configure server redirects)

## Summary

- Hash mode relies on `#` changes that don't trigger server requests
- History mode relies on the HTML5 `pushState` API
- History mode requires a server fallback — otherwise refreshing causes 404
