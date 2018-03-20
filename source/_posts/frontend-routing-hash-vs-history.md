---
title: "前端路由原理：hash 模式 vs history 模式"
date: 2018-03-20 14:39:59
tags:
  - 前端
---

Vue Router 的两种模式几乎每个项目都要选，但很多人不理解为什么有这两种，区别是什么。这篇文章从原理讲起。

## 为什么需要前端路由

传统多页面应用：每次跳转都向服务器请求新页面，有完整的页面刷新。

单页面应用（SPA）：只加载一次 HTML，后续页面切换在客户端完成，不向服务器请求新页面。

问题：怎么让浏览器 URL 变化，但不触发页面刷新？答案就是前端路由。

## Hash 模式

利用 URL 的 `#` 锚点部分（hash）。浏览器对 hash 变化的行为：

1. URL 中 `#` 后面的部分变化时，**不发送请求到服务器**
2. 触发 `hashchange` 事件
3. 保留到浏览器历史记录（可以前进后退）

```javascript
// 监听 hash 变化
window.addEventListener("hashchange", (event) => {
  const newHash = location.hash; // '#/about'
  const path = newHash.slice(1); // '/about'
  renderRoute(path);
});

// 跳转：修改 hash
location.hash = "#/about"; // 触发 hashchange 但不刷新页面
```

**Hash 路由的 URL 样子：**

```
http://example.com/#/
http://example.com/#/about
http://example.com/#/users/123
```

## History 模式

利用 HTML5 的 History API：

```javascript
// pushState: 添加历史记录，修改 URL，但不刷新页面
history.pushState({ page: 1 }, "title", "/about");

// replaceState: 替换当前历史记录
history.replaceState({ page: 1 }, "title", "/about");

// 监听前进后退
window.addEventListener("popstate", (event) => {
  const path = location.pathname; // '/about'
  renderRoute(path);
});
```

**History 路由的 URL 样子：**

```
http://example.com/
http://example.com/about
http://example.com/users/123
```

URL 更干净，没有 `#`。

## 两者的核心区别

| 特性       | Hash 模式                | History 模式 |
| ---------- | ------------------------ | ------------ |
| URL 外观   | 带 `#`                   | 干净         |
| 服务器配置 | 无需配置                 | 需要配置     |
| 兼容性     | 更好（IE8+）             | IE10+        |
| SEO        | 一般（`#` 后内容有争议） | 更好         |

## History 模式必须配置服务器

这是 History 模式最大的坑。

用户直接访问 `http://example.com/users/123`，服务器会尝试找 `/users/123` 这个文件，没找到就 404。

解决方案：**服务器把所有路径都返回 `index.html`**，由前端路由处理。

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

**开发环境（webpack-dev-server）：**

```javascript
devServer: {
  historyApiFallback: true; // 自动处理
}
```

## Vue Router 配置

```javascript
const router = new VueRouter({
  mode: 'history',  // 'hash' 是默认值
  routes: [...]
})
```

## 简单实现一个 Hash 路由

理解原理最好的方式是自己实现：

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
  { path: "/", component: () => "<h1>首页</h1>" },
  { path: "/about", component: () => "<h1>关于</h1>" },
]);

router.push("/about");
```

## 选哪个

- **大多数项目**：History 模式，URL 更干净，SEO 更好，但记得配服务器
- **需要兼容旧浏览器**：Hash 模式
- **纯静态部署**（GitHub Pages 等）：Hash 模式（不能配置服务器重定向）

## 小结

- Hash 模式靠 `#` 变化不触发服务器请求
- History 模式靠 HTML5 `pushState` API
- History 模式一定要配服务器的 fallback，否则刷新 404
