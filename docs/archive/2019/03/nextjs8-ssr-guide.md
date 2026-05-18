---
title: "Next.js 8 深度上手：SSR 与静态导出"
date: 2019-03-05 15:08:40
tags:
  - 前端
readingTime: 2
description: "公司有个官网要做 SEO，调研了 Next.js，最终选了它。记录一下踩坑过程。"
---

公司有个官网要做 SEO，调研了 Next.js，最终选了它。记录一下踩坑过程。

## 为什么选 Next.js

- React 官方推荐的服务端渲染框架
- 文件系统路由，不用配置 react-router
- 支持 SSR、SSG（静态生成）、混合模式
- 8.0 版本加入了自动静态优化（Automatic Static Optimization）

## 核心概念

```jsx
// pages/index.js → 路由 /
// pages/about.js → 路由 /about
// pages/products/[id].js → 动态路由 /products/123

// pages/products/[id].js
function ProductPage({ product }) {
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  );
}

// 服务端数据获取（每次请求都执行）
ProductPage.getInitialProps = async ({ query }) => {
  const { id } = query;
  const product = await fetch(`https://api.example.com/products/${id}`).then(
    (r) => r.json(),
  );

  return { product };
};

export default ProductPage;
```

## 自动静态优化

Next.js 8 会自动判断页面是否可以静态生成：

```jsx
// 这个页面没有 getInitialProps → 自动静态化（HTML 预渲染）
function AboutPage() {
  return <div>关于我们</div>;
}

// 有 getInitialProps → SSR（每次请求动态生成）
AboutPage.getInitialProps = async () => {
  const data = await fetchSomething();
  return { data };
};
```

## API Routes（8.0 新特性）

Next.js 8 开始支持写后端接口：

```javascript
// pages/api/contact.js
export default function handler(req, res) {
  if (req.method === "POST") {
    const { email, message } = req.body;

    // 发邮件、存数据库...
    sendEmail({ to: "admin@example.com", message });

    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
```

小型全栈应用直接用 Next.js，不需要单独的后端服务。

## 自定义 \_app.js 和 \_document.js

```jsx
// pages/_app.js：全局 layout、全局样式、路由变化
import App from "next/app";
import Layout from "../components/Layout";
import "../styles/global.css";

function MyApp({ Component, pageProps }) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

// 全局 getInitialProps（比如获取用户信息）
MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);
  const user = await fetchUser(appContext.ctx);
  return { ...appProps, pageProps: { user } };
};

export default MyApp;
```

```jsx
// pages/_document.js：自定义 HTML 结构（加第三方脚本、meta 标签）
import Document, { Html, Head, Main, NextScript } from "next/document";

class MyDocument extends Document {
  render() {
    return (
      <Html lang="zh-CN">
        <Head>
          <meta name="theme-color" content="#000000" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
```

## 静态导出（SEO + CDN）

```javascript
// next.config.js
module.exports = {
  exportPathMap: async function () {
    // 导出静态 HTML（适合不需要 SSR 的页面）
    return {
      "/": { page: "/" },
      "/about": { page: "/about" },
    };
  },
};
```

```bash
next build && next export
# 生成 out/ 目录，可以直接部署到 CDN
```

## 性能优化

```jsx
import dynamic from "next/dynamic";
import Image from "next/image"; // 自动图片优化（Next.js 10+ 特性，先记录）

// 动态导入（代码分割）
const HeavyChart = dynamic(() => import("../components/HeavyChart"), {
  loading: () => <Spinner />,
  ssr: false, // 不在服务端渲染（浏览器 API 依赖）
});
```

## 小结

- Next.js 文件即路由，SSR/SSG 混合模式
- `getInitialProps` 在服务端和客户端都可能运行（注意区分环境）
- API Routes 让 Next.js 可以做轻量全栈
- 没有 `getInitialProps` 的页面会自动静态化，性能最好
- 项目实践建议：官网类用静态导出，后台管理用 CSR，电商用 SSR
