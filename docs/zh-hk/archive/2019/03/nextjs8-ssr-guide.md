---
title: "Next.js 8 深度上手：SSR 與靜態導出"
date: 2019-03-05 15:08:40
tags:
  - 前端
readingTime: 2
description: "公司有個官網要做 SEO，調研了 Next.js，最終選了它。記錄一下踩坑過程。"
wordCount: 252
---

公司有個官網要做 SEO，調研了 Next.js，最終選了它。記錄一下踩坑過程。

## 為什麼選 Next.js

- React 官方推薦的服務端渲染框架
- 文件系統路由，不用配置 react-router
- 支持 SSR、SSG（靜態生成）、混合模式
- 8.0 版本加入了自動靜態優化（Automatic Static Optimization）

## 核心概念

```jsx
// pages/index.js → 路由 /
// pages/about.js → 路由 /about
// pages/products/[id].js → 動態路由 /products/123

// pages/products/[id].js
function ProductPage({ product }) {
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  );
}

// 服務端數據獲取（每次請求都執行）
ProductPage.getInitialProps = async ({ query }) => {
  const { id } = query;
  const product = await fetch(`https://api.example.com/products/${id}`).then(
    (r) => r.json(),
  );

  return { product };
};

export default ProductPage;
```

## 自動靜態優化

Next.js 8 會自動判斷頁面是否可以靜態生成：

```jsx
// 這個頁面沒有 getInitialProps → 自動靜態化（HTML 預渲染）
function AboutPage() {
  return <div>關於我們</div>;
}

// 有 getInitialProps → SSR（每次請求動態生成）
AboutPage.getInitialProps = async () => {
  const data = await fetchSomething();
  return { data };
};
```

## API Routes（8.0 新特性）

Next.js 8 開始支持寫後端接口：

```javascript
// pages/api/contact.js
export default function handler(req, res) {
  if (req.method === "POST") {
    const { email, message } = req.body;

    // 發郵件、存數據庫...
    sendEmail({ to: "admin@example.com", message });

    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
```

小型全棧應用直接用 Next.js，不需要單獨的後端服務。

## 自定義 \_app.js 和 \_document.js

```jsx
// pages/_app.js：全局 layout、全局樣式、路由變化
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

// 全局 getInitialProps（比如獲取用户信息）
MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);
  const user = await fetchUser(appContext.ctx);
  return { ...appProps, pageProps: { user } };
};

export default MyApp;
```

```jsx
// pages/_document.js：自定義 HTML 結構（加第三方腳本、meta 標籤）
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

## 靜態導出（SEO + CDN）

```javascript
// next.config.js
module.exports = {
  exportPathMap: async function () {
    // 導出靜態 HTML（適合不需要 SSR 的頁面）
    return {
      "/": { page: "/" },
      "/about": { page: "/about" },
    };
  },
};
```

```bash
next build && next export
# 生成 out/ 目錄，可以直接部署到 CDN
```

## 性能優化

```jsx
import dynamic from "next/dynamic";
import Image from "next/image"; // 自動圖片優化（Next.js 10+ 特性，先記錄）

// 動態導入（代碼分割）
const HeavyChart = dynamic(() => import("../components/HeavyChart"), {
  loading: () => <Spinner />,
  ssr: false, // 不在服務端渲染（瀏覽器 API 依賴）
});
```

## 小結

- Next.js 文件即路由，SSR/SSG 混合模式
- `getInitialProps` 在服務端和客户端都可能運行（注意區分環境）
- API Routes 讓 Next.js 可以做輕量全棧
- 沒有 `getInitialProps` 的頁面會自動靜態化，性能最好
- 項目實踐建議：官網類用靜態導出，後台管理用 CSR，電商用 SSR
