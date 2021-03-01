---
title: "HTTPS 工作原理和前端相关知识"
date: 2018-07-31 14:48:32
tags:
  - HTTP
---

HTTPS 已经是现代 Web 的标配，但具体是怎么工作的？和前端开发有什么关联？整理一下。

## HTTP vs HTTPS

```
HTTP：明文传输，中间人可以看到和修改所有内容

HTTPS = HTTP + TLS（传输层安全协议）
  - 加密：数据对中间人不可读
  - 验证：确认连接的服务器是真的，不是仿冒的
  - 完整性：数据传输中没有被篡改
```

## TLS 握手简化版

```
1. 客户端 → 服务器：我支持的 TLS 版本、加密算法列表
2. 服务器 → 客户端：选定的加密算法 + 数字证书（含公钥）
3. 客户端：验证证书合法性（CA 签名）
4. 客户端 → 服务器：用公钥加密一个随机数
5. 双方：用随机数派生出对称加密密钥
6. 之后通信：用对称密钥加密（速度快）
```

## 数字证书

```
证书包含：
  - 域名（你的网站地址）
  - 公钥
  - 颁发机构（CA）
  - 有效期
  - CA 的数字签名

浏览器验证证书：
  1. 域名是否和当前访问的一致
  2. 有效期是否过期
  3. CA 签名是否合法（是否是受信任的 CA 签发）
```

## 前端开发中的 HTTPS 问题

**混合内容（Mixed Content）**

```html
<!-- HTTPS 页面里加载 HTTP 资源 → 被浏览器阻止 -->
<img src="http://example.com/image.jpg" />
<!-- 被阻止 -->
<script src="http://cdn.com/lib.js"></script>
<!-- 被阻止 -->

<!-- 修复：改成 HTTPS 或者用相对协议 -->
<img src="https://example.com/image.jpg" />
<img src="//example.com/image.jpg" />
<!-- 相对协议，自动使用当前页面协议 -->
```

**本地开发的 HTTPS**

```bash
# 用 mkcert 创建本地可信证书（不需要 --ignore-certificate-errors）
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
// 只在 HTTPS 下才发送这个 Cookie
document.cookie = "token=xxx; Secure; HttpOnly";
```

## HSTS（HTTP 严格传输安全）

```
服务器告诉浏览器：以后都用 HTTPS 访问我，不要用 HTTP

响应头：
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

浏览器会记住这个指令，即使用户输入 `http://example.com`，也会自动改成 HTTPS。

## 证书类型

```
DV（域名验证）：只验证域名所有权，几分钟申请，免费
  - Let's Encrypt 就是这种
  - 适合个人网站、博客

OV（组织验证）：验证域名 + 组织信息，需要几天
  - 显示公司名，适合企业网站

EV（扩展验证）：最严格，需要 1-2 周
  - 浏览器地址栏显示绿色公司名（现在大多数浏览器取消了绿色）
  - 银行、大型电商用
```

## 小结

- HTTPS = HTTP + TLS，提供加密、身份验证、完整性保证
- TLS 握手：非对称加密交换密钥，然后用对称加密通信
- 混合内容：HTTPS 页面必须所有资源都是 HTTPS
- 本地开发：用 mkcert 生成可信证书，避免证书警告
- Let's Encrypt 提供免费 DV 证书，没理由不上 HTTPS