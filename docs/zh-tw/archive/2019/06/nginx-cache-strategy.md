---
title: "Nginx 前端快取策略配置實戰"
date: 2019-06-17 17:13:38
tags:
  - 工程化
readingTime: 6
description: "前端效能最佳化離不開快取策略，而 Nginx 作為最常用的靜態資源伺服器，掌握它的快取配置是每個前端工程師的必備技能。"
---

前端效能最佳化離不開快取策略，而 Nginx 作為最常用的靜態資源伺服器，掌握它的快取配置是每個前端工程師的必備技能。

## 瀏覽器快取回顧

在配置 Nginx 之前，先回顧一下瀏覽器快取的整個流程：

1. 首先檢查 **強快取**（Expires / Cache-Control），命中則直接使用本地快取
2. 強快取未命中，進入**協商快取**（Last-Modified / ETag），向伺服器驗證資源是否過期
3. 伺服器返回 304 則使用快取，返回 200 則返回新資源

```
瀏覽器請求 → 強快取命中？→ 是 → 直接用快取（200 from cache）
                ↓ 否
           協商快取 → 傳送請求帶 If-Modified-Since / If-None-Match
                ↓
           伺服器判斷 → 304 → 用快取
                     → 200 → 返回新資源
```

## expires 指令

`expires` 是 Nginx 最簡單的快取設定方式，它會自動新增 `Cache-Control` 和 `Expires` 響應頭。

```nginx
server {
    listen 80;
    server_name static.example.com;

    # HTML 檔案不快取，每次都要驗證
    location ~* \.html$ {
        expires -1;
        # 等價於 Cache-Control: no-cache
    }

    # CSS/JS 檔案快取 1 年（適合帶 hash 的檔名）
    location ~* \.(css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 圖片快取 30 天
    location ~* \.(png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # 字型檔案快取 1 年
    location ~* \.(woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public";
    }

    # API 介面不快取
    location /api/ {
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

`expires` 支援的引數：
- `expires 30d` — 快取 30 天
- `expires -1` — 設為過去時間，等同於 `no-cache`
- `expires off` — 不新增快取頭（使用 Nginx 預設）
- `expires max` — 快取 10 年（等同於 `expires 10y`）

## Cache-Control 精細控制

有時候 `expires` 不夠靈活，需要直接用 `add_header` 設定 `Cache-Control` 來做更精細的控制。

```nginx
server {
    # 場景1：帶 hash 的靜態資源，長期快取 + immutable
    # 檔名如 app.a1b2c3d4.js，內容變了檔名就變了
    location ~* \.[a-f0-9]{8}\.(css|js)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        # immutable 告訴瀏覽器：這個檔案永遠不會變，別發請求驗證
    }

    # 場景2：API 資料，完全不快取
    location /api/ {
        add_header Cache-Control "no-store";
        # no-store = 瀏覽器完全不快取，每次都重新請求
    }

    # 場景3：需要每次都向伺服器驗證的頁面
    location /dashboard {
        add_header Cache-Control "no-cache";
        # no-cache = 可以快取，但每次都要向伺服器驗證
    }

    # 場景4：私有資料，只允許瀏覽器快取，CDN 不能快取
    location /user/ {
        add_header Cache-Control "private, max-age=3600";
    }
}
```

Cache-Control 常用指令速查：

| 指令 | 含義 |
|
------|------|
| `public` | 瀏覽器和 CDN 都可以快取 |
| `private` | 只有瀏覽器可以快取 |
| `no-cache` | 可以快取，但每次必須驗證 |
| `no-store` | 完全不快取 |
| `max-age=N` | 快取有效期（秒） |
| `immutable` | 資源不會變化，不需要驗證 |

## ETag 和 Last-Modified

Nginx 預設開啟 ETag，會自動為靜態資源新增 `ETag` 和 `Last-Modified` 響應頭，支援協商快取。

```nginx
server {
    # Nginx 預設開啟，一般不需要改動
    etag on;

    # Last-Modified 基於檔案的修改時間，自動新增
    # 如果需要關閉：
    # etag off;
    # if_modified_since off;

    location /static/ {
        root /var/www/html;

        # 確保協商快取頭正常工作
        # Nginx 會自動處理 If-None-Match 和 If-Modified-Since
        # 如果資源未修改，返回 304 Not Modified
    }
}
```

當瀏覽器傳送請求時，會帶上之前的快取資訊：

```
# 基於 ETag
If-None-Match: "5d1f3a2b-1a2b3"

# 基於 Last-Modified
If-Modified-Since: Mon, 10 Jun 2019 08:00:00 GMT
```

Nginx 收到後對比，如果匹配就直接返回 `304`，不返回檔案內容，節省頻寬。

## proxy_cache 反向代理快取

當 Nginx 作為反向代理時，可以用 `proxy_cache` 快取後端響應，減少後端壓力。

```nginx
# 在 http 塊中定義快取區域
http {
    # 定義快取路徑和引數
    proxy_cache_path /var/cache/nginx
                     levels=1:2          # 目錄層級
                     keys_zone=my_cache:10m  # 共享記憶體區，存 key，10MB 約可存 8 萬個 key
                     max_size=1g         # 磁碟最大快取 1GB
                     inactive=60m        # 60 分鐘沒人訪問就刪除
                     use_temp_path=off;  # 直接寫入快取目錄，提升效能

    server {
        listen 80;
        server_name api.example.com;

        location /api/products {
            proxy_pass http://backend;

            # 啟用快取
            proxy_cache my_cache;

            # 快取 key 的組成
            proxy_cache_key "$scheme$request_method$host$request_uri";

            # 不同狀態碼的快取時間
            proxy_cache_valid 200 301 302 10m;  # 200/301/302 快取 10 分鐘
            proxy_cache_valid 404 1m;            # 404 快取 1 分鐘
            proxy_cache_valid any 5m;            # 其他狀態快取 5 分鐘

            # 當後端不可用時，使用過期快取
            proxy_cache_use_stale error timeout updating
                                  http_500 http_502 http_503 http_504;

            # 快取鎖定：多個請求同時到達時，只讓一個請求去後端
            proxy_cache_lock on;
            proxy_cache_lock_timeout 5s;

            # 新增除錯頭，方便檢視快取命中情況
            add_header X-Cache-Status $upstream_cache_status;
            # 可能的值：HIT / MISS / EXPIRED / BYPASS / STALE
        }

        # 不快取的介面
        location /api/user {
            proxy_pass http://backend;
            proxy_no_cache 1;
            proxy_cache_bypass 1;
            # 等價於 Cache-Control: no-cache
        }
    }
}
```

除錯時檢視響應頭 `X-Cache-Status`：

```bash
# 第一次請求
$ curl -I http://api.example.com/api/products
X-Cache-Status: MISS    # 未命中，請求了後端

# 第二次請求
$ curl -I http://api.example.com/api/products
X-Cache-Status: HIT     # 命中快取，直接返回
```

## 檔名 Hash 與快取失效

現代前端構建工具（Webpack、Parcel）都會給靜態資原始檔名加上 content hash：

```javascript
// webpack.config.js
module.exports = {
    output: {
        filename: '[name].[contenthash:8].js',
        // 輸出示例: main.a1b2c3d4.js
        // 內容變了 → hash 變了 → 檔名變了 → 是全新資源
    },
};
```

配合 Nginx 的長期快取策略：

```nginx
server {
    # 帶 hash 的檔案：永久快取
    # 正則匹配檔名中包含 8 位 hex 的檔案
    location ~* \.[a-f0-9]{8}\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        root /var/www/html/build;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;  # 靜態資源不需要記錄日誌
    }

    # HTML 檔案：不快取，確保總是獲取最新版本
    location ~* \.html$ {
        root /var/www/html/build;
        expires -1;
        add_header Cache-Control "no-cache";
        # 使用者每次開啟頁面都會驗證 HTML
        # HTML 中引用的 JS/CSS 檔名變了，自然就載入新版本
    }

    # SPA 路由：返回 index.html，不快取
    location / {
        root /var/www/html/build;
        try_files $uri $uri/ /index.html;
        expires -1;
    }
}
```

這套策略的核心思路：**hash 控制快取失效**。檔名不變就一直用快取，內容一改檔名就變，瀏覽器自動請求新檔案。

## Gzip 壓縮配置

Gzip 雖然不是快取，但和快取策略配合使用效果更好——壓縮後快取的體積更小。

```nginx
http {
    # 開啟 gzip
    gzip on;

    # 壓縮級別（1-9），推薦 6，平衡壓縮率和 CPU 消耗
    gzip_comp_level 6;

    # 最小壓縮檔案大小，小於此值不壓縮（本身已經很小了）
    gzip_min_length 256;

    # 需要壓縮的檔案型別
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

    # 為代理請求也啟用壓縮
    gzip_proxied any;

    # Vary 頭，告訴快取伺服器根據 Accept-Encoding 區分快取
    gzip_vary on;

    # 停用 IE6 的 gzip（已經不適用了，但有些配置模板還留著）
    gzip_disable "msie6";
}
```

驗證 Gzip 是否生效：

```bash
# 檢視響應頭
$ curl -I -H "Accept-Encoding: gzip" http://example.com/app.js
Content-Encoding: gzip
Vary: Accept-Encoding

# 對比檔案大小
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
        add_header Access-Control-Max-Age 86400;  # 預檢請求快取 24 小時

        if ($request_method = 'OPTIONS') {
            return 204;
        }

        proxy_pass http://backend;
    }
}
```

注意：`add_header` 在 Nginx 的某些情況下不會繼承，如果配置了 `proxy_cache` 或 `try_files`，需要在對應的 `location` 塊中重新宣告 `add_header`。

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

    # 帶 hash 的靜態資源 — 長期快取
    location ~* \.[a-f0-9]{8}\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # 其他靜態資源 — 短期快取
    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public";
        access_log off;
    }

    # HTML — 不快取
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

- **帶 hash 的靜態資源**用 `expires 1y` + `immutable` 長期快取，檔案內容變化時檔名自動變化
- **HTML 檔案**用 `no-cache` 確保每次驗證，它是資源引用的入口
- **API 介面**用 `no-store` 完全不快取，保證資料即時性
- **proxy_cache** 適合反向代理場景，快取後端響應，降低後端壓力
- **Gzip 壓縮**配合快取使用效果更好，JS/CSS 通常能壓縮 70% 以上
- 合理的快取策略能讓二次訪問速度提升數倍，是價效比最高的效能最佳化手段
