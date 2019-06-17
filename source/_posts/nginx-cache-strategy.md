---
title: "Nginx 前端缓存策略配置实战"
date: 2019-06-17 17:13:38
tags:
  - 工程化
---

前端性能优化离不开缓存策略，而 Nginx 作为最常用的静态资源服务器，掌握它的缓存配置是每个前端工程师的必备技能。

## 浏览器缓存回顾

在配置 Nginx 之前，先回顾一下浏览器缓存的整个流程：

1. 首先检查 **强缓存**（Expires / Cache-Control），命中则直接使用本地缓存
2. 强缓存未命中，进入**协商缓存**（Last-Modified / ETag），向服务器验证资源是否过期
3. 服务器返回 304 则使用缓存，返回 200 则返回新资源

```
浏览器请求 → 强缓存命中？→ 是 → 直接用缓存（200 from cache）
                ↓ 否
           协商缓存 → 发送请求带 If-Modified-Since / If-None-Match
                ↓
           服务器判断 → 304 → 用缓存
                     → 200 → 返回新资源
```

## expires 指令

`expires` 是 Nginx 最简单的缓存设置方式，它会自动添加 `Cache-Control` 和 `Expires` 响应头。

```nginx
server {
    listen 80;
    server_name static.example.com;

    # HTML 文件不缓存，每次都要验证
    location ~* \.html$ {
        expires -1;
        # 等价于 Cache-Control: no-cache
    }

    # CSS/JS 文件缓存 1 年（适合带 hash 的文件名）
    location ~* \.(css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 图片缓存 30 天
    location ~* \.(png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # 字体文件缓存 1 年
    location ~* \.(woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public";
    }

    # API 接口不缓存
    location /api/ {
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

`expires` 支持的参数：
- `expires 30d` — 缓存 30 天
- `expires -1` — 设为过去时间，等同于 `no-cache`
- `expires off` — 不添加缓存头（使用 Nginx 默认）
- `expires max` — 缓存 10 年（等同于 `expires 10y`）

## Cache-Control 精细控制

有时候 `expires` 不够灵活，需要直接用 `add_header` 设置 `Cache-Control` 来做更精细的控制。

```nginx
server {
    # 场景1：带 hash 的静态资源，长期缓存 + immutable
    # 文件名如 app.a1b2c3d4.js，内容变了文件名就变了
    location ~* \.[a-f0-9]{8}\.(css|js)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        # immutable 告诉浏览器：这个文件永远不会变，别发请求验证
    }

    # 场景2：API 数据，完全不缓存
    location /api/ {
        add_header Cache-Control "no-store";
        # no-store = 浏览器完全不缓存，每次都重新请求
    }

    # 场景3：需要每次都向服务器验证的页面
    location /dashboard {
        add_header Cache-Control "no-cache";
        # no-cache = 可以缓存，但每次都要向服务器验证
    }

    # 场景4：私有数据，只允许浏览器缓存，CDN 不能缓存
    location /user/ {
        add_header Cache-Control "private, max-age=3600";
    }
}
```

Cache-Control 常用指令速查：

| 指令 | 含义 |
|------|------|
| `public` | 浏览器和 CDN 都可以缓存 |
| `private` | 只有浏览器可以缓存 |
| `no-cache` | 可以缓存，但每次必须验证 |
| `no-store` | 完全不缓存 |
| `max-age=N` | 缓存有效期（秒） |
| `immutable` | 资源不会变化，不需要验证 |

## ETag 和 Last-Modified

Nginx 默认开启 ETag，会自动为静态资源添加 `ETag` 和 `Last-Modified` 响应头，支持协商缓存。

```nginx
server {
    # Nginx 默认开启，一般不需要改动
    etag on;

    # Last-Modified 基于文件的修改时间，自动添加
    # 如果需要关闭：
    # etag off;
    # if_modified_since off;

    location /static/ {
        root /var/www/html;

        # 确保协商缓存头正常工作
        # Nginx 会自动处理 If-None-Match 和 If-Modified-Since
        # 如果资源未修改，返回 304 Not Modified
    }
}
```

当浏览器发送请求时，会带上之前的缓存信息：

```
# 基于 ETag
If-None-Match: "5d1f3a2b-1a2b3"

# 基于 Last-Modified
If-Modified-Since: Mon, 10 Jun 2019 08:00:00 GMT
```

Nginx 收到后对比，如果匹配就直接返回 `304`，不返回文件内容，节省带宽。

## proxy_cache 反向代理缓存

当 Nginx 作为反向代理时，可以用 `proxy_cache` 缓存后端响应，减少后端压力。

```nginx
# 在 http 块中定义缓存区域
http {
    # 定义缓存路径和参数
    proxy_cache_path /var/cache/nginx
                     levels=1:2          # 目录层级
                     keys_zone=my_cache:10m  # 共享内存区，存 key，10MB 约可存 8 万个 key
                     max_size=1g         # 磁盘最大缓存 1GB
                     inactive=60m        # 60 分钟没人访问就删除
                     use_temp_path=off;  # 直接写入缓存目录，提升性能

    server {
        listen 80;
        server_name api.example.com;

        location /api/products {
            proxy_pass http://backend;

            # 启用缓存
            proxy_cache my_cache;

            # 缓存 key 的组成
            proxy_cache_key "$scheme$request_method$host$request_uri";

            # 不同状态码的缓存时间
            proxy_cache_valid 200 301 302 10m;  # 200/301/302 缓存 10 分钟
            proxy_cache_valid 404 1m;            # 404 缓存 1 分钟
            proxy_cache_valid any 5m;            # 其他状态缓存 5 分钟

            # 当后端不可用时，使用过期缓存
            proxy_cache_use_stale error timeout updating
                                  http_500 http_502 http_503 http_504;

            # 缓存锁定：多个请求同时到达时，只让一个请求去后端
            proxy_cache_lock on;
            proxy_cache_lock_timeout 5s;

            # 添加调试头，方便查看缓存命中情况
            add_header X-Cache-Status $upstream_cache_status;
            # 可能的值：HIT / MISS / EXPIRED / BYPASS / STALE
        }

        # 不缓存的接口
        location /api/user {
            proxy_pass http://backend;
            proxy_no_cache 1;
            proxy_cache_bypass 1;
            # 等价于 Cache-Control: no-cache
        }
    }
}
```

调试时查看响应头 `X-Cache-Status`：

```bash
# 第一次请求
$ curl -I http://api.example.com/api/products
X-Cache-Status: MISS    # 未命中，请求了后端

# 第二次请求
$ curl -I http://api.example.com/api/products
X-Cache-Status: HIT     # 命中缓存，直接返回
```

## 文件名 Hash 与缓存失效

现代前端构建工具（Webpack、Parcel）都会给静态资源文件名加上 content hash：

```javascript
// webpack.config.js
module.exports = {
    output: {
        filename: '[name].[contenthash:8].js',
        // 输出示例: main.a1b2c3d4.js
        // 内容变了 → hash 变了 → 文件名变了 → 是全新资源
    },
};
```

配合 Nginx 的长期缓存策略：

```nginx
server {
    # 带 hash 的文件：永久缓存
    # 正则匹配文件名中包含 8 位 hex 的文件
    location ~* \.[a-f0-9]{8}\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        root /var/www/html/build;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;  # 静态资源不需要记录日志
    }

    # HTML 文件：不缓存，确保总是获取最新版本
    location ~* \.html$ {
        root /var/www/html/build;
        expires -1;
        add_header Cache-Control "no-cache";
        # 用户每次打开页面都会验证 HTML
        # HTML 中引用的 JS/CSS 文件名变了，自然就加载新版本
    }

    # SPA 路由：返回 index.html，不缓存
    location / {
        root /var/www/html/build;
        try_files $uri $uri/ /index.html;
        expires -1;
    }
}
```

这套策略的核心思路：**hash 控制缓存失效**。文件名不变就一直用缓存，内容一改文件名就变，浏览器自动请求新文件。

## Gzip 压缩配置

Gzip 虽然不是缓存，但和缓存策略配合使用效果更好——压缩后缓存的体积更小。

```nginx
http {
    # 开启 gzip
    gzip on;

    # 压缩级别（1-9），推荐 6，平衡压缩率和 CPU 消耗
    gzip_comp_level 6;

    # 最小压缩文件大小，小于此值不压缩（本身已经很小了）
    gzip_min_length 256;

    # 需要压缩的文件类型
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        application/x-font-ttf
        font/opentype;

    # 为代理请求也启用压缩
    gzip_proxied any;

    # Vary 头，告诉缓存服务器根据 Accept-Encoding 区分缓存
    gzip_vary on;

    # 禁用 IE6 的 gzip（已经不适用了，但有些配置模板还留着）
    gzip_disable "msie6";
}
```

验证 Gzip 是否生效：

```bash
# 查看响应头
$ curl -I -H "Accept-Encoding: gzip" http://example.com/app.js
Content-Encoding: gzip
Vary: Accept-Encoding

# 对比文件大小
$ curl -o /dev/null -s -w "%{size_download}" http://example.com/app.js
158234

$ curl -o /dev/null -s -w "%{size_download}" -H "Accept-Encoding: gzip" http://example.com/app.js
42156
# 压缩后体积减少了约 73%
```

## CORS 跨域头配置

前端开发中经常需要配置跨域，Nginx 可以统一处理。

```nginx
server {
    listen 80;
    server_name api.example.com;

    # 方案1：允许所有来源（开发环境用）
    location /api/ {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";

        # 处理预检请求
        if ($request_method = 'OPTIONS') {
            return 204;
        }

        proxy_pass http://backend;
    }

    # 方案2：只允许指定来源（生产环境推荐）
    location /api/ {
        # 白名单
        set $cors_origin "";
        if ($http_origin ~* "^https://(www\.example\.com|admin\.example\.com)$") {
            set $cors_origin $http_origin;
        }

        add_header Access-Control-Allow-Origin $cors_origin;
        add_header Access-Control-Allow-Credentials "true";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        add_header Access-Control-Max-Age 86400;  # 预检请求缓存 24 小时

        if ($request_method = 'OPTIONS') {
            return 204;
        }

        proxy_pass http://backend;
    }
}
```

注意：`add_header` 在 Nginx 的某些情况下不会继承，如果配置了 `proxy_cache` 或 `try_files`，需要在对应的 `location` 块中重新声明 `add_header`。

## 完整配置示例

把以上所有配置整合到一个完整的站点配置中：

```nginx
# /etc/nginx/conf.d/frontend.conf

upstream backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name www.example.com;
    root /var/www/html/build;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/javascript application/javascript
               application/json image/svg+xml application/x-font-ttf;
    gzip_vary on;

    # 带 hash 的静态资源 — 长期缓存
    location ~* \.[a-f0-9]{8}\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # 其他静态资源 — 短期缓存
    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public";
        access_log off;
    }

    # HTML — 不缓存
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache";
    }

    # API 请求 — 反向代理
    location /api/ {
        add_header Cache-Control "no-store";
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
    }
}
```

## 小结

- **带 hash 的静态资源**用 `expires 1y` + `immutable` 长期缓存，文件内容变化时文件名自动变化
- **HTML 文件**用 `no-cache` 确保每次验证，它是资源引用的入口
- **API 接口**用 `no-store` 完全不缓存，保证数据实时性
- **proxy_cache** 适合反向代理场景，缓存后端响应，降低后端压力
- **Gzip 压缩**配合缓存使用效果更好，JS/CSS 通常能压缩 70% 以上
- 合理的缓存策略能让二次访问速度提升数倍，是性价比最高的性能优化手段
