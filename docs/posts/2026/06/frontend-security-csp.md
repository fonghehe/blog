---
title: "前端安全 2026：CSP v3 与子资源完整性"
date: 2026-06-15 14:39:35
tags:
  - 安全
  - CSP
readingTime: 3
description: "Content Security Policy v3 和 Subresource Integrity 是 2026 年前端安全的两大支柱。本文讨论 CSP 的配置策略、SRI 的使用方法和常见的安全陷阱。"
wordCount: 446
---

前端安全不再是"可选的附加项"，而是应用架构的核心部分。2026 年的 Web 安全环境更加复杂，CSP v3 和 SRI 提供了标准化的防护机制。

## Content Security Policy 基础

CSP 通过 HTTP 头或 meta 标签控制资源加载：

```html
<!-- HTTP 头 -->
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123'

<!-- meta 标签 -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'nonce-abc123'">
```

CSP 指令分类：

| 指令 | 作用 | 示例 |
|------|------|------|
| `default-src` | 默认策略 | `'self'` |
| `script-src` | 脚本来源 | `'self' 'nonce-xxx'` |
| `style-src` | 样式来源 | `'self' 'unsafe-inline'` |
| `img-src` | 图片来源 | `'self' data: https:` |
| `connect-src` | API 请求 | `'self' https://api.example.com` |
| `font-src` | 字体来源 | `'self' https://fonts.gstatic.com` |

## CSP v3 新特性

CSP v3 引入了更精细的控制：

```html
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-abc123' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

关键改进：
- **`strict-dynamic`**：信任已有脚本加载的新脚本
- **`frame-ancestors`**：替代 `X-Frame-Options`
- **`base-uri`**：防止 `<base>` 标签劫持
- **`form-action`**：限制表单提交目标

## Nonce 生成与使用

Nonce（一次性随机数）是推荐的脚本加载方式：

```typescript
// 服务端生成 nonce
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// 中间件添加 CSP 头
app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
  `);
  
  next();
});

// 模板中使用 nonce
app.get('/', (req, res) => {
  res.send(`
    <script nonce="${res.locals.cspNonce}">
      console.log('安全执行');
    </script>
  `);
});
```

## Subresource Integrity

SRI 确保外部资源不被篡改：

```html
<!-- 基础用法 -->
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>

<!-- 多个哈希值 -->
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-hash1 sha256-hash2"
        crossorigin="anonymous"></script>
```

## 动态 SRI

对于动态生成的资源，需要在服务端计算哈希：

```typescript
import { createHash } from 'crypto';

function generateSRI(content: string): string {
  const hash = createHash('sha384')
    .update(content)
    .digest('base64');
  return `sha384-${hash}`;
}

// 中间件
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(content) {
    if (typeof content === 'string' && content.includes('<script')) {
      // 提取内联脚本并计算 SRI
      const scripts = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
      if (scripts) {
        scripts.forEach(script => {
          const innerContent = script.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
          if (innerContent) {
            const sri = generateSRI(innerContent);
            // 注入 integrity 属性
          }
        });
      }
    }
    return originalSend.call(this, content);
  };
  
  next();
});
```

## 常见安全陷阱

**陷阱 1：`unsafe-inline` 的风险**

```html
<!-- 危险：允许任意内联脚本 -->
Content-Security-Policy: script-src 'self' 'unsafe-inline'

<!-- 安全：使用 nonce -->
Content-Security-Policy: script-src 'self' 'nonce-abc123'
```

`unsafe-inline` 会让 XSS 攻击变得容易，应该尽量避免。

**陷阱 2：`unsafe-eval` 的风险**

```html
<!-- 危险：允许 eval -->
Content-Security-Policy: script-src 'self' 'unsafe-eval'

<!-- 安全：避免 eval -->
Content-Security-Policy: script-src 'self'
```

许多框架（如 Vue、React）在生产模式下不需要 `eval`。

**陷阱 3：SRI 与动态资源**

```html
<!-- 错误：动态资源不能用 SRI -->
<script src="/api/bundle.js" integrity="sha384-xxx"></script>

<!-- 正确：静态资源用 SRI -->
<script src="/static/vendor.js" integrity="sha384-xxx"></script>
```

SRI 只适用于内容固定的资源。

## 调试 CSP 违规

CSP 违规报告可以帮助发现问题：

```html
Content-Security-Policy: default-src 'self'; report-uri /csp-report
```

```typescript
app.post('/csp-report', (req, res) => {
  console.error('CSP 违规:', req.body);
  res.status(204).end();
});
```

浏览器控制台也会显示违规信息：

```
Refused to execute inline script because it violates the following 
Content Security Policy directive: "script-src 'self' 'nonce-abc123'"
```

## 渐进式部署

CSP 应该渐进式部署，避免破坏现有功能：

```html
<!-- 阶段 1：仅报告 -->
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report

<!-- 阶段 2：宽松策略 -->
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval'

<!-- 阶段 3：严格策略 -->
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xxx'
```

## 小结

CSP v3 和 SRI 是 2026 年前端安全的基础。CSP 控制资源加载来源，SRI 确保资源完整性。部署时应该渐进式启用，先用 Report-Only 收集数据，再逐步收紧策略。安全不是一次性工作，而是持续的过程。
