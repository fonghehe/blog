---
title: "Next.js 8 深掘り：SSRと静的エクスポート"
date: 2019-03-05 15:08:40
tags:
  - フロントエンド
readingTime: 1
description: "会社のウェブサイトでSEOが必要になり、Next.jsを調査して最終的に選択した。その過程で出会った課題を記録しておく。"
wordCount: 265
---

会社のウェブサイトでSEOが必要になり、Next.jsを調査して最終的に選択した。その過程で出会った課題を記録しておく。

## なぜNext.jsを選んだのか

- React公式推奨のサーバーサイドレンダリングフレームワーク
- ファイルシステムルーティング——react-routerの設定不要
- SSR、SSG（静的生成）、ハイブリッドモードをサポート
- バージョン8.0で自動静的最適化（Automatic Static Optimization）が追加

## コアコンセプト

```jsx
// pages/index.js → ルート /
// pages/about.js → ルート /about
// pages/products/[id].js → 動的ルート /products/123

// pages/products/[id].js
function ProductPage({ product }) {
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  );
}

// サーバーサイドデータ取得（リクエストごとに実行）
ProductPage.getInitialProps = async ({ query }) => {
  const { id } = query;
  const product = await fetch(`https://api.example.com/products/${id}`).then(
    (r) => r.json(),
  );

  return { product };
};

export default ProductPage;
```

## 自動静的最適化

Next.js 8はページを静的生成できるかどうかを自動的に判断する：

```jsx
// このページにはgetInitialPropsがない → 自動的に静的化（HTML事前レンダリング）
function AboutPage() {
  return <div>私たちについて</div>;
}

// getInitialPropsがある → SSR（リクエストごとに動的生成）
AboutPage.getInitialProps = async () => {
  const data = await fetchSomething();
  return { data };
};
```

## APIルート（8.0の新機能）

Next.js 8からバックエンドAPIエンドポイントの作成をサポート：

```javascript
// pages/api/contact.js
export default function handler(req, res) {
  if (req.method === "POST") {
    const { email, message } = req.body;

    // メール送信、データベースへの保存...
    sendEmail({ to: "admin@example.com", message });

    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
```

小規模なフルスタックアプリケーションはNext.js単体で十分——別のバックエンドサービスは不要だ。

## \_app.jsと\_document.jsのカスタマイズ

```jsx
// pages/_app.js：グローバルレイアウト、グローバルスタイル、ルート変更処理
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
```
