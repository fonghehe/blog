---
title: "Nginx 前端緩存策略配置實戰"
date: 2019-06-17 17:13:38
tags:
  - 工程化
readingTime: 6
description: "前端性能優化離不開緩存策略，而 Nginx 作為最常用的靜態資源服務器，掌握它的緩存配置是每個前端工程師的必備技能。"
wordCount: 843
---

前端性能優化離不開緩存策略，而 Nginx 作為最常用的靜態資源服務器，掌握它的緩存配置是每個前端工程師的必備技能。

## 瀏覽器緩存回顧

在配置 Nginx 之前，先回顧一下瀏覽器緩存的整個流程：

1. 首先檢查 **強緩存**（Expires / Cache-Control），命中則直接使用本地緩存
2. 強緩存未命中，進入**協商緩存**（Last-Modified / ETag），向服務器驗證資源是否過期
3. 服務器返回 304 則使用緩存，返回 200 則返回新資源

```
瀏覽器請求 → 強緩存命中？→ 是 → 直接用緩存（200 from cache）
                ↓ 否
           協商緩存 → 發送請求帶 If-Modified-Since / If-None-Match
                ↓
           服務器判斷 → 304 → 用緩存
                     → 200 → 返回新資源
```

## expires 指令

`expires` 是 Nginx 最簡單的緩存設置方式，它會自動添加 `Cache-Control` 和 `Expires` 響應頭。

```nginx
server {
    listen 80;
    server_name static.example.com;

    # HTML 文件不緩存，每次都要驗證
    location ~* \.html$ {
        expires -1;
        # 等價於 Cache-Control: no-cache
    }

    # CSS/JS 文件緩存 1 年（適合帶 hash 的文件名）
    location ~* \.(css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 圖片緩存 30 天
    location ~* \.(png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # 字體文件緩存 1 年
    location ~* \.(woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public";
    }

    # API 接口不緩存
    location /api/ {
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

`expires` 支持的參數：
- `expires 30d` — 緩存 30 天
- `expires -1` — 設為過去時間，等同於 `no-cache`
- `expires off` — 不添加緩存頭（使用 Nginx 默認）
- `expires max` — 緩存 10 年（等同於 `expires 10y`）

## Cache-Control 精細控制

有時候 `expires` 不夠靈活，需要直接用 `add_header` 設置 `Cache-Control` 來做更精細的控制。

```nginx
server {
    # 場景1：帶 hash 的靜態資源，長期緩存 + immutable
    # 文件名如 app.a1b2c3d4.js，內容變了文件名就變了
    location ~* \.[a-f0-9]{8}\.(css|js)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        # immutable 告訴瀏覽器：這個文件永遠不會變，別發請求驗證
    }

    # 場景2：API 數據，完全不緩存
    location /api/ {
        add_header Cache-Control "no-store";
        # no-store = 瀏覽器完全不緩存，每次都重新請求
    }

    # 場景3：需要每次都向服務器驗證的頁面
    location /dashboard {
        add_header Cache-Control "no-cache";
        # no-cache = 可以緩存，但每次都要向服務器驗證
    }

    # 場景4：私有數據，只允許瀏覽器緩存，CDN 不能緩存
    location /user/ {
        add_header Cache-Control "private, max-age=3600";
    }
}
```

Cache-Control 常用指令速查：

| 指令 | 含義 |
|
------|------|
| `public` | 瀏覽器和 CDN 都可以緩存 |
| `private` | 只有瀏覽器可以緩存 |
| `no-cache` | 可以緩存，但每次必須驗證 |
| `no-store` | 完全不緩存 |
| `max-age=N` | 緩存有效期（秒） |
| `immutable` | 資源不會變化，不需要驗證 |

## ETag 和 Last-Modified

Nginx 默認開啓 ETag，會自動為靜態資源添加 `ETag` 和 `Last-Modified` 響應頭，支持協商緩存。

```nginx
server {
    # Nginx 默認開啓，一般不需要改動
    etag on;

    # Last-Modified 基於文件的修改時間，自動添加
    # 如果需要關閉：
    # etag off;
    # if_modified_since off;

    location /static/ {
        root /var/www/html;

        # 確保協商緩存頭正常工作
        # Nginx 會自動處理 If-None-Match 和 If-Modified-Since
        # 如果資源未修改，返回 304 Not Modified
    }
}
```

當瀏覽器發送請求時，會帶上之前的緩存信息：

```
# 基於 ETag
If-None-Match: "5d1f3a2b-1a2b3"

# 基於 Last-Modified
If-Modified-Since: Mon, 10 Jun 2019 08:00:00 GMT
```

Nginx 收到後對比，如果匹配就直接返回 `304`，不返回文件內容，節省帶寬。

## proxy_cache 反向代理緩存

當 Nginx 作為反向代理時，可以用 `proxy_cache` 緩存後端響應，減少後端壓力。

```nginx
# 在 http 塊中定義緩存區域
http {
    # 定義緩存路徑和參數
    proxy_cache_path /var/cache/nginx
                     levels=1:2          # 目錄層級
                     keys_zone=my_cache:10m  # 共享內存區，存 key，10MB 約可存 8 萬個 key
                     max_size=1g         # 磁盤最大緩存 1GB
                     inactive=60m        # 60 分鐘沒人訪問就刪除
                     use_temp_path=off;  # 直接寫入緩存目錄，提升性能

    server {
        listen 80;
        server_name api.example.com;

        location /api/products {
            proxy_pass http://backend;

            # 啓用緩存
            proxy_cache my_cache;

            # 緩存 key 的組成
            proxy_cache_key "$scheme$request_method$host$request_uri";

            # 不同狀態碼的緩存時間
            proxy_cache_valid 200 301 302 10m;  # 200/301/302 緩存 10 分鐘
            proxy_cache_valid 404 1m;            # 404 緩存 1 分鐘
            proxy_cache_valid any 5m;            # 其他狀態緩存 5 分鐘

            # 當後端不可用時，使用過期緩存
            proxy_cache_use_stale error timeout updating
                                  http_500 http_502 http_503 http_504;

            # 緩存鎖定：多個請求同時到達時，只讓一個請求去後端
            proxy_cache_lock on;
            proxy_cache_lock_timeout 5s;

            # 添加調試頭，方便查看緩存命中情況
            add_header X-Cache-Status $upstream_cache_status;
            # 可能的值：HIT / MISS / EXPIRED / BYPASS / STALE
        }

        # 不緩存的接口
        location /api/user {
            proxy_pass http://backend;
            proxy_no_cache 1;
            proxy_cache_bypass 1;
            # 等價於 Cache-Control: no-cache
        }
    }
}
```

調試時查看響應頭 `X-Cache-Status`：

```bash
# 第一次請求
$ curl -I http://api.example.com/api/products
X-Cache-Status: MISS    # 未命中，請求了後端

# 第二次請求
$ curl -I http://api.example.com/api/products
X-Cache-Status: HIT     # 命中緩存，直接返回
```

## 文件名 Hash 與緩存失效

現代前端構建工具（Webpack、Parcel）都會給靜態資源文件名加上 content hash：

```javascript
// webpack.config.js
module.exports = {
    output: {
        filename: '[name].[contenthash:8].js',
        // 輸出示例: main.a1b2c3d4.js
        // 內容變了 → hash 變了 → 文件名變了 → 是全新資源
    },
};
```

配合 Nginx 的長期緩存策略：

```nginx
server {
    # 帶 hash 的文件：永久緩存
    # 正則匹配文件名中包含 8 位 hex 的文件
    location ~* \.[a-f0-9]{8}\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        root /var/www/html/build;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;  # 靜態資源不需要記錄日誌
    }

    # HTML 文件：不緩存，確保總是獲取最新版本
    location ~* \.html$ {
        root /var/www/html/build;
        expires -1;
        add_header Cache-Control "no-cache";
        # 用户每次打開頁面都會驗證 HTML
        # HTML 中引用的 JS/CSS 文件名變了，自然就加載新版本
    }

    # SPA 路由：返回 index.html，不緩存
    location / {
        root /var/www/html/build;
        try_files $uri $uri/ /index.html;
        expires -1;
    }
}
```

這套策略的核心思路：**hash 控制緩存失效**。文件名不變就一直用緩存，內容一改文件名就變，瀏覽器自動請求新文件。

## Gzip 壓縮配置

Gzip 雖然不是緩存，但和緩存策略配合使用效果更好——壓縮後緩存的體積更小。

```nginx
http {
    # 開啓 gzip
    gzip on;

    # 壓縮級別（1-9），推薦 6，平衡壓縮率和 CPU 消耗
    gzip_comp_level 6;

    # 最小壓縮文件大小，小於此值不壓縮（本身已經很小了）
    gzip_min_length 256;

    # 需要壓縮的文件類型
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

    # 為代理請求也啓用壓縮
    gzip_proxied any;

    # Vary 頭，告訴緩存服務器根據 Accept-Encoding 區分緩存
    gzip_vary on;

    # 禁用 IE6 的 gzip（已經不適用了，但有些配置模板還留着）
    gzip_disable "msie6";
}
```

驗證 Gzip 是否生效：

```bash
# 查看響應頭
$ curl -I -H "Accept-Encoding: gzip" http://example.com/app.js
Content-Encoding: gzip
Vary: Accept-Encoding

# 對比文件大小
$ curl -o /dev/null -s -w "%{size_download}" http://example.com/app.js
158234

$ curl -o /dev/null -s -w "%{size_download}" -H "Accept-Encoding: gzip" http://example.com/app.js
42156
# 壓縮後體積減少了約 73%
```

## CORS 跨域頭配置

前端開發中經常需要配置跨域，Nginx 可以統一處理。

```nginx
server {
    listen 80;
    server_name api.example.com;

    # 方案1：允許所有來源（開發環境用）
    location /api/ {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";

        # 處理預檢請求
        if ($request_method = 'OPTIONS') {
            return 204;
        }

        proxy_pass http://backend;
    }

    # 方案2：只允許指定來源（生產環境推薦）
    location /api/ {
        # 白名單
        set $cors_origin "";
        if ($http_origin ~* "^https://(www\.example\.com|admin\.example\.com)$") {
            set $cors_origin $http_origin;
        }

        add_header Access-Control-Allow-Origin $cors_origin;
        add_header Access-Control-Allow-Credentials "true";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        add_header Access-Control-Max-Age 86400;  # 預檢請求緩存 24 小時

        if ($request_method = 'OPTIONS') {
            return 204;
        }

        proxy_pass http://backend;
    }
}
```

注意：`add_header` 在 Nginx 的某些情況下不會繼承，如果配置了 `proxy_cache` 或 `try_files`，需要在對應的 `location` 塊中重新聲明 `add_header`。

## 完整配置示例

把以上所有配置整合到一個完整的站點配置中：

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

    # Gzip 壓縮
    gzip on;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/javascript application/javascript
               application/json image/svg+xml application/x-font-ttf;
    gzip_vary on;

    # 帶 hash 的靜態資源 — 長期緩存
    location ~* \.[a-f0-9]{8}\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # 其他靜態資源 — 短期緩存
    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public";
        access_log off;
    }

    # HTML — 不緩存
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache";
    }

    # API 請求 — 反向代理
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

## 小結

- **帶 hash 的靜態資源**用 `expires 1y` + `immutable` 長期緩存，文件內容變化時文件名自動變化
- **HTML 文件**用 `no-cache` 確保每次驗證，它是資源引用的入口
- **API 接口**用 `no-store` 完全不緩存，保證數據實時性
- **proxy_cache** 適合反向代理場景，緩存後端響應，降低後端壓力
- **Gzip 壓縮**配合緩存使用效果更好，JS/CSS 通常能壓縮 70% 以上
- 合理的緩存策略能讓二次訪問速度提升數倍，是性價比最高的性能優化手段
