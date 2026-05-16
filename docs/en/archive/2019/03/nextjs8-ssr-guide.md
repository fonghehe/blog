---
title: "A Deep Dive into Next.js 8: SSR and Static Export"
date: 2019-03-05 15:08:40
tags:
  - Frontend
readingTime: 1
description: "Our company needed an SEO-friendly website, so I evaluated Next.js and ultimately chose it. Here's a record of the challenges encountered along the way."
---

Our company needed an SEO-friendly website, so I evaluated Next.js and ultimately chose it. Here's a record of the challenges encountered along the way.

## Why Choose Next.js

- The officially recommended server-side rendering framework for React
- File-system routing — no need to configure react-router
- Supports SSR, SSG (static generation), and hybrid mode
- Version 8.0 introduced Automatic Static Optimization

## Core Concepts

```jsx
// pages/index.js → route /
// pages/about.js → route /about
// pages/products/[id].js → dynamic route /products/123

// pages/products/[id].js
function ProductPage({ product }) {
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  );
}

// Server-side data fetching (runs on every request)
ProductPage.getInitialProps = async ({ query }) => {
  const { id } = query;
  const product = await fetch(`https://api.example.com/products/${id}`).then(
    (r) => r.json(),
  );

  return { product };
};

export default ProductPage;
```

## Automatic Static Optimization

Next.js 8 automatically determines whether a page can be statically generated:

```jsx
// This page has no getInitialProps → automatically static (pre-rendered HTML)
function AboutPage() {
  return <div>About Us</div>;
}

// Has getInitialProps → SSR (dynamically generated on each request)
AboutPage.getInitialProps = async () => {
  const data = await fetchSomething();
  return { data };
};
```

## API Routes (New in 8.0)

Next.js 8 added support for writing backend API endpoints:

```javascript
// pages/api/contact.js
export default function handler(req, res) {
  if (req.method === "POST") {
    const { email, message } = req.body;

    // Send email, store in database...
    sendEmail({ to: "admin@example.com", message });

    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
```

For small full-stack applications, Next.js alone is sufficient — no separate backend service needed.

## Customizing \_app.js and \_document.js

```jsx
// pages/_app.js: global layout, global styles, route change handling
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
