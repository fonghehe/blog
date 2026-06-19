---
title: "前端安全 2026：CSP Level 3 与 Trusted Types 的落地实践"
date: 2026-06-19 12:56:59
tags:
  - 安全
  - Security
readingTime: 4
description: "XSS 攻击依然是前端安全的最大威胁。本文系统讲解 CSP Level 3 和 Trusted Types 在实际项目中的应用，帮助你构建更安全的前端应用。"
wordCount: 399
---

XSS（跨站脚本攻击）是 OWASP Top 10 中长期存在的安全威胁。2026 年，CSP Level 3 和 Trusted Types 已经成为防御 XSS 的核心技术。理解它们的原理和实践方法，是每个前端开发者的必备能力。

## XSS 攻击的本质

XSS 攻击的核心是攻击者能够向页面注入恶意脚本并执行：

```html
<!-- 反射型 XSS -->
<img src="x" onerror="alert('XSS')">

<!-- 存储型 XSS -->
<div class="comment">
  <script>stealCookies()</script>
</div>

<!-- DOM 型 XSS -->
<script>
  document.getElementById('output').innerHTML = location.hash.slice(1)
</script>
```

传统的 XSS 防御方式（如输入过滤、输出编码）虽然有效，但容易出错。CSP 和 Trusted Types 提供了更可靠的防御机制。

## CSP Level 3 基础

Content Security Policy（CSP）通过限制页面可以加载和执行的资源来防御 XSS：

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-random123';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
">
```

### 关键指令详解

```html
<!-- script-src：控制脚本来源 -->
<script-src 'self' 'nonce-random123' https://cdn.example.com>

<!-- style-src：控制样式来源 -->
<style-src 'self' 'unsafe-inline' https://fonts.googleapis.com>

<!-- connect-src：控制 AJAX/WebSocket 连接 -->
connect-src 'self' https://api.example.com wss://ws.example.com

<!-- img-src：控制图片来源 -->
img-src 'self' data: https: blob:

<!-- font-src：控制字体来源 -->
font-src 'self' https://fonts.gstatic.com

<!-- frame-src：控制 iframe 来源 -->
frame-src 'self' https://www.youtube.com
```

### Nonce 和 Hash

Nonce（一次性随机数）和 Hash 是 CSP 中最安全的脚本加载方式：

```html
<!-- Nonce 方式 -->
<script nonce="random123">
  // 只有带有正确 nonce 的脚本才能执行
  console.log('This script is allowed')
</script>

<!-- Hash 方式 -->
<script sha256="base64EncodedHash">
  // 脚本内容的哈希值必须匹配
</script>
```

```javascript
// 服务端生成 nonce
import crypto from 'crypto'

function generateNonce() {
  return crypto.randomBytes(16).toString('base64')
}

// 设置 CSP 头
app.use((req, res, next) => {
  const nonce = generateNonce()
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'unsafe-inline';
  `)
  res.locals.nonce = nonce
  next()
})
```

## Trusted Types 详解

Trusted Types 是 Google 提出的 DOM XSS 防御方案，它强制所有 DOM 操作使用类型安全的 API：

```html
<meta http-equiv="Content-Security-Policy" content="
  trusted-types default;
">
```

### 基本用法

```javascript
// 禁止直接使用 innerHTML
element.innerHTML = userInput  // ❌ 违反 CSP

// 必须通过 TrustedHTML
const trustedHTML = trustedTypes.createPolicy('default', {
  createHTML: (input) => {
    // 清理输入
    return DOMPurify.sanitize(input)
  }
})

element.innerHTML = trustedHTML.createHTML(userInput)  // ✅ 允许
```

### 创建自定义策略

```javascript
// 定义多个策略，每个策略负责不同的清理逻辑
const htmlPolicy = trustedTypes.createPolicy('htmlPolicy', {
  createHTML: (input) => {
    // 允许的 HTML 标签白名单
    const allowedTags = ['b', 'i', 'em', 'strong', 'a', 'p']
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: ['href', 'title']
    })
  }
})

const scriptURLPolicy = trustedTypes.createPolicy('scriptURLPolicy', {
  createScriptURL: (input) => {
    // 只允许特定域名的脚本
    const allowedDomains = ['cdn.example.com', 'self']
    const url = new URL(input, location.origin)
    
    if (allowedDomains.includes(url.hostname) || input.startsWith('/')) {
      return url
    }
    
    throw new Error(`不允许的脚本来源: ${input}`)
  }
})

const urlPolicy = trustedTypes.createPolicy('urlPolicy', {
  createScriptURL: (input) => {
    // 禁止 javascript: 协议
    if (input.startsWith('javascript:')) {
      throw new Error('禁止 javascript: 协议')
    }
    return new URL(input, location.origin)
  }
})
```

### 与 DOMPurify 集成

```javascript
import DOMPurify from 'dompurify'

const purifyPolicy = trustedTypes.createPolicy('purify', {
  createHTML: (input) => {
    return DOMPurify.sanitize(input, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a'],
      ALLOWED_ATTR: ['href', 'title', 'target'],
      FORBID_TAGS: ['script', 'style', 'iframe'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload']
    })
  }
})

// 安全地渲染用户输入
function renderUserContent(content) {
  element.innerHTML = purifyPolicy.createHTML(content)
}
```

## 实际项目应用

### React/Vue 项目配置

```javascript
// React 项目：配置 CSP
// index.html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.example.com;
">

// React 组件中使用 Trusted Types
import { useEffect } from 'react'

function UserContent({ html }) {
  const containerRef = useRef(null)
  
  useEffect(() => {
    if (containerRef.current) {
      const policy = trustedTypes.createPolicy('react-content', {
        createHTML: (input) => DOMPurify.sanitize(input)
      })
      
      containerRef.current.innerHTML = policy.createHTML(html)
    }
  }, [html])
  
  return <div ref={containerRef} />
}
```

### Webpack 配置

```javascript
// webpack.config.js
const Crypto = require('crypto')

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      templateParameters: {
        NONCE: Crypto.randomBytes(16).toString('base64')
      }
    })
  ],
  devServer: {
    headers: {
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'nonce-${Crypto.randomBytes(16).toString('base64')}';
        style-src 'self' 'unsafe-inline';
      `
    }
  }
}
```

### Express 中间件

```javascript
import crypto from 'crypto'
import helmet from 'helmet'

app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.locals.nonce = nonce
  
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://api.example.com;
    font-src 'self' https://fonts.gstatic.com;
    frame-src 'self' https://www.youtube.com;
    trusted-types default htmlPolicy purify;
  `)
  
  next()
})

// 模板中使用 nonce
app.get('/', (req, res) => {
  res.render('index', { nonce: res.locals.nonce })
})
```

## 调试和监控

### CSP 违规报告

```javascript
// 配置 CSP 报告端点
app.post('/csp-report', (req, res) => {
  const report = req.body['csp-report']
  
  console.error('CSP 违规:', {
    documentUri: report['document-uri'],
    violatedDirective: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number']
  })
  
  // 发送到监控系统
  sendToMonitoring(report)
  
  res.status(204).end()
})
```

```html
<!-- 配置 CSP 报告 -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  report-uri /csp-report;
  report-to csp-endpoint;
">
```

### Trusted Types 违规处理

```javascript
// 监听 Trusted Types 违规
if (window.trustedTypes && window.trustedTypes.enablePolicyFor featureNames) {
  window.addEventListener('securitypolicyviolation', (event) => {
    if (event.violatedDirective === 'trusted-types') {
      console.error('Trusted Types 违规:', {
        originalPolicy: event.originalPolicy,
        violatedDirective: event.violatedDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber
      })
      
      // 发送到监控系统
      sendViolationReport({
        type: 'trusted-types',
        details: event
      })
    }
  })
}
```

## 渐进式迁移策略

对于现有项目，推荐渐进式迁移：

```javascript
// 第一步：只报告不阻止
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  report-uri /csp-report;
">

// 第二步：添加常用指令
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  report-uri /csp-report;
">

// 第三步：启用 Trusted Types
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self' 'unsafe-inline';
  trusted-types default;
  report-uri /csp-report;
">

// 第四步：严格模式
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  trusted-types default;
  require-trusted-types-for 'script';
">
```

## 小结

CSP Level 3 和 Trusted Types 是现代前端安全的基石。CSP 通过限制资源来源来防御 XSS，Trusted Types 通过类型安全的 API 来防止 DOM 注入攻击。在实际项目中，推荐渐进式迁移：先报告违规，再逐步启用严格策略。配合 Nonce、Hash 和 DOMPurify，可以构建出真正安全的前端应用。
