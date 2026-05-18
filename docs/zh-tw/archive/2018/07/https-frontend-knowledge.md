---
title: "HTTPS 工作原理和前端相關知識"
date: 2018-07-31 14:48:32
tags:
  - HTTP
readingTime: 1
description: "HTTPS 已經是現代 Web 的標配，但具體是怎麼工作的？和前端開發有什麼關聯？整理一下。"
---

HTTPS 已經是現代 Web 的標配，但具體是怎麼工作的？和前端開發有什麼關聯？整理一下。

## HTTP vs HTTPS

```
HTTP：明文傳輸，中間人可以看到和修改所有內容

HTTPS = HTTP + TLS（傳輸層安全協議）
  - 加密：資料對中間人不可讀
  - 驗證：確認連線的伺服器是真的，不是仿冒的
  - 完整性：資料傳輸中沒有被篡改
```

## TLS 握手簡化版

```
1. 客戶端 → 伺服器：我支援的 TLS 版本、加密演算法列表
2. 伺服器 → 客戶端：選定的加密演算法 + 數字證書（含公鑰）
3. 客戶端：驗證證書合法性（CA 簽名）
4. 客戶端 → 伺服器：用公鑰加密一個隨機數
5. 雙方：用隨機數派生出對稱加密金鑰
6. 之後通訊：用對稱金鑰加密（速度快）
```

## 數字證書

```
證書包含：
  - 域名（你的網站地址）
  - 公鑰
  - 頒發機構（CA）
  - 有效期
  - CA 的數字簽名

瀏覽器驗證證書：
  1. 域名是否和當前訪問的一致
  2. 有效期是否過期
  3. CA 簽名是否合法（是否是受信任的 CA 簽發）
```

## 前端開發中的 HTTPS 問題

**混合內容（Mixed Content）**

```html
<!-- HTTPS 頁面里加載 HTTP 資源 → 被瀏覽器阻止 -->
<img src="http://example.com/image.jpg" />
<!-- 被阻止 -->
<script src="http://cdn.com/lib.js"></script>
<!-- 被阻止 -->

<!-- 修復：改成 HTTPS 或者用相對協議 -->
<img src="https://example.com/image.jpg" />
<img src="//example.com/image.jpg" />
<!-- 相對協議，自動使用當前頁面協議 -->
```

**本地開發的 HTTPS**

```bash
# 用 mkcert 建立本地可信證書（不需要 --ignore-certificate-errors）
mkcert -install
mkcert localhost 127.0.0.1

# webpack devServer 配置
devServer: {
  https: {
    key: fs.readFileSync('./localhost-key.pem'),
    cert: fs.readFileSync('./localhost.pem')
  }
}
```

**Secure Cookie**

```javascript
// 只在 HTTPS 下才傳送這個 Cookie
document.cookie = "token=xxx; Secure; HttpOnly";
```

## HSTS（HTTP 嚴格傳輸安全）

```
伺服器告訴瀏覽器：以後都用 HTTPS 訪問我，不要用 HTTP

響應頭：
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

瀏覽器會記住這個指令，即使使用者輸入 `http://example.com`，也會自動改成 HTTPS。

## 證書型別

```
DV（域名驗證）：只驗證域名所有權，幾分鐘申請，免費
  - Let's Encrypt 就是這種
  - 適合個人網站、部落格

OV（組織驗證）：驗證域名 + 組織資訊，需要幾天
  - 顯示公司名，適合企業網站

EV（擴充套件驗證）：最嚴格，需要 1-2 周
  - 瀏覽器位址列顯示綠色公司名（現在大多數瀏覽器取消了綠色）
  - 銀行、大型電商用
```

## 小結

- HTTPS = HTTP + TLS，提供加密、身份驗證、完整性保證
- TLS 握手：非對稱加密交換金鑰，然後用對稱加密通訊
- 混合內容：HTTPS 頁面必須所有資源都是 HTTPS
- 本地開發：用 mkcert 生成可信證書，避免證書警告
- Let's Encrypt 提供免費 DV 證書，沒理由不上 HTTPS