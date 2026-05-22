---
title: "Vite SSR 実践"
date: 2021-08-09 15:28:34
tags:
  - Vite
  - Vue
  - React

readingTime: 3
description: "最近、社内の運用プラットフォームを CSR から Vite SSR に移行しました。その際の経験と課題を記録します。Vite 2.x の SSR サポートは既にかなり成熟していますが、ドキュメントが少なく、実際に使う際にはいくつか注意すべき点があります。"
wordCount: 501
---

最近、社内の運用プラットフォームを CSR から Vite SSR に移行しました。その際の経験と課題を記録します。Vite 2.x の SSR サポートは既にかなり成熟していますが、ドキュメントが少なく、実際に使う際にはいくつか注意すべき点があります。

## 基本アーキテクチャ

```
client/          # 客户端代码
  App.vue
  main.ts        # 客户端入口
  entry-client.ts # hydrate 入口
  entry-server.ts # 渲染入口
server/
  index.ts       # Express/Koa 服务端
```

## サーバーエントリー

```typescript
// entry-server.ts
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createRouter } from '../router'
import App from '../App.vue'

export async function render(url: string) {
  const app = createSSRApp(App)
  const router = createRouter()

  app.use(router)
  await router.push(url)
  await router.isReady()

  const html = await renderToString(app)
  return html
}
```

## クライアントエントリー

```typescript
// entry-client.ts
import { createApp } from 'vue'
import { createRouter } from './router'
import App from './App.vue'

const app = createApp(App)
const router = createRouter()

app.use(router)

// hydrate：サーバー側でレンダリングされた HTML をインタラクティブな SPA に「活性化」する
router.isReady().then(() => {
  app.mount('#app', true) // true = hydrate モード
})
```

## Expressサービス

```typescript
// server/index.ts
import express from 'express'
import fs from 'fs'
import path from 'path'
import { createServer as createViteServer } from 'vite'

async function startServer() {
  const app = express()

  const vite = await createViteServer({
    server: { middlewareMode: 'ssr' },
    appType: 'custom',
  })

  app.use(vite.middlewares)

  app.use('*', async (req, res) => {
    const url = req.originalUrl

    try {
      // index.html テンプレートを読み込む
      let template = fs.readFileSync(
        path.resolve(__dirname, '../index.html'),
        'utf-8'
      )

      // Vite がテンプレートを変換（HMR クライアントなどを注入）
      template = await vite.transformIndexHtml(url, template)

      // サーバーエントリーをロード（Vite がリアルタイムでコンパイル）
      const { render } = await vite.ssrLoadModule('/src/entry-server.ts')

      const appHtml = await render(url)

      // プレースホルダーを置換
      const html = template.replace('<!--ssr-outlet-->', appHtml)

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      vite.ssrFixStacktrace(e as Error)
      console.error(e)
      res.status(500).end((e as Error).message)
    }
  })

  app.listen(3000)
}

startServer()
```

## 落とし穴1：CSS処理

Vite SSR はデフォルトでは CSS を抽出しないため、手動で処理する必要があります：

```typescript
// レンダリング前にスタイルを収集
import { renderToString } from '@vue/server-renderer'

const app = createSSRApp(App)
const html = await renderToString(app)

// Vite SSR の CSS は manifest を通じて自動的に注入される
// 本番環境では manifest.json を読み取る必要がある
```

プロダクションビルドには `ssrManifest` が必要：

```bash
# クライアントをビルド（ssr-manifest.json を生成）
vite build --outDir dist/client --ssrManifest

# サーバーをビルド
vite build --outDir dist/server --ssr src/entry-server.ts
```

```typescript
// 本番環境 server/index.ts
import express from 'express'
import fs from 'fs'
import path from 'path'
import { render } from '../dist/server/entry-server.js'

const app = express()

// 静的アセット
app.use(express.static(path.resolve(__dirname, '../dist/client'), {
  index: false, // index.html を自動で返さない
}))

// SSR manifest
const manifest = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../dist/client/ssr-manifest.json'),
    'utf-8'
  )
)

app.use('*', async (req, res) => {
  const url = req.originalUrl

  try {
    let template = fs.readFileSync(
      path.resolve(__dirname, '../dist/client/index.html'),
      'utf-8'
    )

    const appHtml = await render(url, manifest)

    // manifest から現在のページが依存する CSS/JS を特定
    const preloadLinks = renderPreloadLinks(appHtml, manifest)

    const html = template
      .replace('<!--preload-links-->', preloadLinks)
      .replace('<!--ssr-outlet-->', appHtml)

    res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
  } catch (e) {
    console.error(e)
    res.status(500).end((e as Error).message)
  }
})
```

## 落とし穴2：ブラウザAPIがサーバー側で使用不可

```typescript
// ❌ サーバー側には window/document/localStorage がない
const token = localStorage.getItem('token')

// ✅ 条件分岐で対応
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token')
  }
  return null
}

// ✅ または import.meta.env.SSR を使用（Vite が提供）
if (!import.meta.env.SSR) {
  // このコードはクライアント bundle にのみ含まれる
  initAnalytics()
}
```

## 落とし穴3：データプリフェッチ

```typescript
// 推奨：コンポーネントで asyncData を定義し、ルートマッチ後にサーバー側で呼び出す
// composables/useAsyncData.ts
export function useAsyncData<T>(key: string, fetcher: () => Promise<T>) {
  const data = ref<T | null>(null)
  const pending = ref(true)

  // サーバー側：直接呼び出し
  // クライアント側：window.__SSR_DATA__ を確認
  if (import.meta.env.SSR) {
    // サーバー側で実行し、結果を HTML に注入
  } else {
    // クライアント hydrate 時に __SSR_DATA__ から読み取り
    const ssrData = (window as any).__SSR_DATA__
    if (ssrData?.[key]) {
      data.value = ssrData[key]
      pending.value = false
    } else {
      fetcher().then((res) => {
        data.value = res
        pending.value = false
      })
    }
  }

  return { data, pending }
}
```

## パフォーマンス比較

| 指標 | CSR | SSR |
|------|-----|-----|
| 初回バイト時間 | ~200ms | ~50ms |
| 初回画面表示 | ~1.5s | ~0.3s |
| インタラクティブ可能時間 | ~2s | ~1s |

社内運用プラットフォームでは SEO の必要はありませんが、初回画面表示速度の向上は顕著で、特にネットワーク環境が悪い場合に効果的です。

## まとめ

- Vite SSR の開発体験は非常に良い（HMR、リアルタイムコンパイル）が、本番デプロイでは CSS と静的アセットの処理に注意が必要
- ブラウザ API の互換性が最大の落とし穴であり、`import.meta.env.SSR` が核心的な判断基準となる
- データプリフェッチは追加設計が必要（Next.js のような完全な约定がない）
- 初回画面表示速度が重要な Vue 3 プロジェクトに適している；SEO 用途にも使えるが、メンテナンスコストは Nuxt より高い