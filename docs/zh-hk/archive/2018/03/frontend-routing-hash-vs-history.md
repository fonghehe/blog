---
title: "前端路由原理：hash 模式 vs history 模式"
date: 2018-03-20 14:39:59
tags:
  - 前端
readingTime: 2
description: "Vue Router 的兩種模式幾乎每個項目都要選，但很多人不理解為什麼有這兩種，區別是什麼。這篇文章從原理講起。"
wordCount: 509
---

Vue Router 的兩種模式幾乎每個項目都要選，但很多人不理解為什麼有這兩種，區別是什麼。這篇文章從原理講起。

## 為什麼需要前端路由

傳統多頁面應用：每次跳轉都向服務器請求新頁面，有完整的頁面刷新。

單頁面應用（SPA）：隻加載一次 HTML，後續頁面切換在客户端完成，不向服務器請求新頁面。

問題：怎麼讓瀏覽器 URL 變化，但不觸發頁面刷新？答案就是前端路由。

## Hash 模式

利用 URL 的 `#` 錨點部分（hash）。瀏覽器對 hash 變化的行為：

1. URL 中 `#` 後面的部分變化時，**不發送請求到服務器**
2. 觸發 `hashchange` 事件
3. 保留到瀏覽器歷史記錄（可以前進後退）

```javascript
// 監聽 hash 變化
window.addEventListener("hashchange", (event) => {
  const newHash = location.hash; // '#/about'
  const path = newHash.slice(1); // '/about'
  renderRoute(path);
});

// 跳轉：修改 hash
location.hash = "#/about"; // 觸發 hashchange 但不刷新頁面
```

**Hash 路由的 URL 樣子：**

```
http://example.com/#/
http://example.com/#/about
http://example.com/#/users/123
```

## History 模式

利用 HTML5 的 History API：

```javascript
// pushState: 添加歷史記錄，修改 URL，但不刷新頁面
history.pushState({ page: 1 }, "title", "/about");

// replaceState: 替換當前歷史記錄
history.replaceState({ page: 1 }, "title", "/about");

// 監聽前進後退
window.addEventListener("popstate", (event) => {
  const path = location.pathname; // '/about'
  renderRoute(path);
});
```

**History 路由的 URL 樣子：**

```
http://example.com/
http://example.com/about
http://example.com/users/123
```

URL 更乾淨，沒有 `#`。

## 兩者的核心區別

| 特性       | Hash 模式                | History 模式 |
| 
---------- | ------------------------ | ------------ |
| URL 外觀   | 帶 `#`                   | 乾淨         |
| 服務器設定 | 無需設定                 | 需要設定     |
| 兼容性     | 更好（IE8+）             | IE10+        |
| SEO        | 一般（`#` 後內容有爭議） | 更好         |

## History 模式必須設定服務器

這是 History 模式最大的坑。

用户直接訪問 `http://example.com/users/123`，服務器會嘗試找 `/users/123` 這個文件，沒找到就 404。

解決方案：**服務器把所有路徑都返回 `index.html`**，由前端路由處理。

**Nginx 配置：**

```nginx
server {
  listen 80;
  root /var/www/myapp;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;  # 找不到文件就返回 index.html
  }
}
```

**Apache .htaccess：**

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

**開發環境（webpack-dev-server）：**

```javascript
devServer: {
  historyApiFallback: true; // 自動處理
}
```

## Vue Router 設定

```javascript
const router = new VueRouter({
  mode: 'history',  // 'hash' 是默認值
  routes: [...]
})
```

## 簡單實現一個 Hash 路由

理解原理最好的方式是自己實現：

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

// 使用
const router = new HashRouter([
  { path: "/", component: () => "<h1>首頁</h1>" },
  { path: "/about", component: () => "<h1>關於</h1>" },
]);

router.push("/about");
```

## 選哪個

- **大多數項目**：History 模式，URL 更乾淨，SEO 更好，但記得配服務器
- **需要相容舊瀏覽器**：Hash 模式
- **純靜態部署**（GitHub Pages 等）：Hash 模式（不能配置服務器重定向）

## 小結

- Hash 模式靠 `#` 變化不觸發服務器請求
- History 模式靠 HTML5 `pushState` API
- History 模式一定要配服務器的 fallback，否則刷新 404
