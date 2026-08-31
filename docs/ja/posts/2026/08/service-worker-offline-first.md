---
title: "Service Worker とオフラインファーストアーキテクチャ：PWA のエンジニアリングプラクティス"
date: 2026-08-09 13:11:22
tags:
  - 工程化
  - PWA
readingTime: 14
description: "Service Worker はブラウザにおいてオフラインファーストを実現できる唯一の技術的基盤である。本記事では、ライフサイクル、キャッシュ戦略マトリクス、Workbox のエンジニアリング、プッシュ通知、バックグラウンド同期、更新戦略まで、PWA オフラインファーストアーキテクチャの完全なエンジニアリングソリューションを体系的に整理し、2026 年における PWA の位置づけと適用シーンについても論じる。"
wordCount: 3053
---

PWA（Progressive Web App）は 2026 年において、「ネイティブアプリを代替できるか」という議論の焦点ではなくなった。App Store と Google Play は依然として強力だが、PWA は独自の位置づけを見出している：配布チャネルの更新が不要、オフラインシーンで利用可能、インストール不要で即利用可能。これらの特性により、PWA は内部ツール、コンテンツ型アプリ、新興市場のシーンで継続的に価値を発揮している。そして PWA の技術的基盤である Service Worker は、依然としてフロントエンドで最も複雑かつ強力な API の一つである。

## Service Worker のライフサイクルとイベントモデル

Service Worker はブラウザのメインスレッドの外で動作する独立したスレッドであり、Web ページとネットワークの間でプロキシとして機能する。独自のライフサイクルを持ち、ページのライフサイクルとは完全に独立している。

```
インストール中 (installing) → インストール完了 (installed) → 有効化中 (activating) → 有効化完了 (activated) → 廃棄 (redundant)
```

```typescript
// sw.ts - Service Worker エントリ
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// install イベント：主要リソースのプレキャッシュ
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        '/',
        '/offline.html',
        '/styles/main.css',
        '/scripts/app.js',
        '/images/logo.svg',
      ]),
    ),
  );
});

// activate イベント：古いキャッシュのクリーンアップ
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_VERSION))
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  // すべてのページを即座に引き継ぐ（ページリロードを待たない）
  self.clients.claim();
});

// fetch イベント：ネットワークリクエストのインターセプト
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // GET リクエスト以外はネットワークへ直接送信
  if (request.method !== 'GET') return;

  // リソースの種類に応じて異なるキャッシュ戦略を使用
  if (request.destination === 'document') {
    event.respondWith(handleNavigation(request));
  } else if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isApiRequest(request.url)) {
    event.respondWith(handleApiRequest(request));
  }
});
```

Service Worker のライフサイクルを理解する上での重要ポイント：**新しいバージョンの Service Worker は即座に古いバージョンを置き換えない**。ユーザーが初回アクセス時に v1 をインストールし、次回アクセス時に v2 が見つかると v2 をインストールするが、即座には有効化しない——v1 が引き続き現在のページを制御している。v1 を使用しているすべてのページが閉じられた後にのみ、v2 が有効化される。これが Service Worker の更新戦略設計の中核となる制約である。

## オフラインファーストアーキテクチャの中核思想

オフラインファースト（Offline First）とは「オフラインでも使える」ことではなく、**キャッシュを第一のデータソースとし、ネットワークを更新手段とする**ことである。従来の Web アプリケーションのデフォルトの動作は「ネットワーク優先」である——毎回のリクエストでネットワークにアクセスし、ネットワークが失敗した場合にエラーとなる。オフラインファーストはこの順序を逆転させる：まずキャッシュからデータを返し（即座に応答）、同時にバックグラウンドでネットワークリクエストを行ってキャッシュを更新する。

この思考の転換がもたらす影響は深い：

- ページの読み込み速度がネットワークに依存しない——キャッシュヒット時にほぼ瞬時
- ネットワークが不安定なシーンでもユーザー体験が一貫する——通信切断による白画面が発生しない
- キャッシュの一貫性問題を処理する必要がある——キャッシュされたデータが古くなる可能性がある

## キャッシュ戦略マトリクス

Workbox は 5 つのコアキャッシュ戦略を提供しており、それぞれ異なるリソースタイプに適している：

```typescript
// リソースごとのキャッシュ戦略マッピング
const strategies = {
  // 1. Cache First：まずキャッシュを検索し、ヒットすれば直接返し、ミスの場合のみネットワークを検索
  // 適用：静的リソース（フォント、画像、CSS/JS バンドル）
  staticAssets: new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 日
      }),
    ],
  }),

  // 2. Network First：まずネットワークを検索し、成功すればキャッシュを更新、失敗すればキャッシュを使用
  // 適用：動的コンテンツ（API レスポンス、HTML ドキュメント）
  dynamicContent: new NetworkFirst({
    cacheName: 'dynamic-content',
    networkTimeoutSeconds: 3, // 3 秒タイムアウトでキャッシュにフォールバック
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 1 日
      }),
    ],
  }),

  // 3. Stale While Revalidate：キャッシュを即座に返し、同時にバックグラウンドでキャッシュを更新
  // 適用：頻繁に更新されるが古いデータでも使えるリソース（ユーザーアバター、非クリティカル API など）
  semiStatic: new StaleWhileRevalidate({
    cacheName: 'semi-static',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 日
      }),
    ],
  }),

  // 4. Network Only：ネットワークのみ、キャッシュしない
  // 適用：キャッシュ不可能なデータ（リアルタイム価格、機密操作など）

  // 5. Cache Only：キャッシュのみ、ネットワークを検索しない
  // 適用：オフラインページ、静的リソースのフォールバック
};
```

戦略選択の中核は、2 つの問いに答えることである：**古いデータが使えるか** と **データの更新頻度はどの程度か**。

| リソースタイプ | 古いデータが利用可能？ | 更新頻度 | 推奨戦略 |
|---------|------------|---------|---------|
| JS/CSS バンドル | 可能 | 毎回デプロイ | Cache First |
| フォントファイル | 可能 | 極めて低い | Cache First |
| HTML ドキュメント | 可能（オフラインフォールバック） | 中 | Network First |
| リスト API | 可能（短期） | 高 | Stale While Revalidate |
| リアルタイムデータ API | 不可 | 極めて高い | Network Only |
| ユーザー操作の書き込み | 該当なし | N/A | Network Only + バックグラウンド同期 |

## Workbox のエンジニアリング利用

Service Worker のキャッシュロジックを手動で記述するとエラーが発生しやすい。Workbox はこれらの複雑さを設定可能なモジュールとしてカプセル化する。2026 年の標準的なアプローチは Vite プラグインで Workbox を統合することである：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt', // 新バージョン時にユーザーにリロードを促す
      injectRegister: false,

      // プレキャッシュマニフェストの注入
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },

      // 開発環境では無効化
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
```

```typescript
// src/sw.ts - カスタム Service Worker（Workbox モジュールを使用）
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// プレキャッシュ（マニフェストは Vite プラグインが注入）
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ナビゲーションリクエスト：Network First + オフラインフォールバックページ
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 3,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
  {
    denylist: [/^\/api/, /^\/admin/],
  },
);
registerRoute(navigationRoute);

// 静的リソース：Cache First
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// 画像：Stale While Revalidate
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
);

// API リクエスト：Stale While Revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 分
      }),
    ],
  }),
);
```

## プッシュ通知（Push Notification）

Push Notification は PWA がネイティブアプリの体験に最も近づける機能である。完全なフローは：サーバー側の VAPID 鍵ペア → ユーザーの購読 → サーバー側のプッシュ → Service Worker の受信 → 通知の表示、という経路で構成される。

```typescript
// クライアント：プッシュの購読
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;

  // 既に購読済みか確認
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  // VAPID 公開鍵の取得
  const vapidPublicKey = await fetch('/api/push/vapid-key').then((r) => r.text());
  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // true が必須：プッシュ通知は必ず通知を表示する
    applicationServerKey: convertedKey,
  });

  // 購読情報をサーバー側に送信
  await fetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: { 'Content-Type': 'application/json' },
  });

  return subscription;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split('').map((c) => c.charCodeAt(0)));
}
```

```typescript
// Service Worker：プッシュイベントの処理
self.addEventListener('push', (event: PushEvent) => {
  const payload = event.data?.json() ?? {};

  const options: NotificationOptions = {
    body: payload.body,
    icon: '/images/icon-192.png',
    badge: '/images/badge-72.png',
    data: {
      url: payload.url,
    },
    actions: payload.actions ?? [],
    tag: payload.tag, // 同じ tag の通知は置き換えられ、蓄積を回避
    requireInteraction: payload.urgent ?? false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options),
  );
});

// 通知クリック：ウィンドウをフォーカスまたは URL を開く
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // 既に開いているウィンドウがあればフォーカスする
      for (const client of allClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // なければ新しいウィンドウを開く
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
```

プッシュ通知の重要な制限事項：iOS Safari は 16.4 以降で Web Push をサポートしているが、ユーザーが事前にサイトをホーム画面に追加している必要がある。これにより iOS でのプッシュ通知のカバレッジが制限される。

## バックグラウンド同期（Background Sync）

バックグラウンド同期が解決する問題は：ユーザーがオフライン時に実行した操作（メッセージの送信、フォームの送信など）が、ネットワーク復旧後に自動的に再試行されることである。これによりデータの一貫性が保証される——ユーザーの操作がネットワーク切断によって失われることはない。

```typescript
// Service Worker：バックグラウンド同期
const bgSyncPlugin = new BackgroundSyncPlugin('failed-requests', {
  maxRetentionTime: 24 * 60, // 再試行の保持期間 24 時間
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        // 成功後にクライアントに通知
        const clients = await self.clients.matchAll();
        clients.forEach((client) =>
          client.postMessage({ type: 'SYNC_SUCCESS', url: entry.request.url }),
        );
      } catch (error) {
        // 再試行失敗、キューに戻す
        await queue.unshiftRequest(entry);
        throw error; // エラーをスローすると Workbox が次回同期時に再試行する
      }
    }
  },
});

// POST リクエストのバックグラウンド同期を登録
registerRoute(
  ({ request }) => request.method === 'POST',
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST',
);
```

```typescript
// クライアント：バックグラウンド同期の登録
async function submitForm(data: FormData) {
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  } catch (error) {
    // ネットワーク失敗時にバックグラウンド同期を登録
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register('submit-form');
      // ユーザーに通知：ネットワーク復旧後にデータが同期される
      showOfflineToast('データは保存されました。ネットワーク復旧後に自動的に同期されます');
    } else {
      // Background Sync 非対応ブラウザはローカルストレージにフォールバック
      await saveToIndexedDB('pending-submits', data);
    }
  }
}
```

## 更新戦略：ユーザーに最新バージョンを届ける

Service Worker の更新は最も問題が発生しやすい工程である。新バージョンがインストールされても即座には有効化されず、ユーザーが古いバージョンを使い続ける可能性がある。更新プロンプトのフローを設計する必要がある：

```typescript
// クライアント：Service Worker 更新管理
class SWUpdateManager {
  private registration: ServiceWorkerRegistration | null = null;

  async init() {
    if (!('serviceWorker' in navigator)) return;

    this.registration = await navigator.serviceWorker.register('/sw.js');

    // 新しい Service Worker のインストールを監視
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // 既に古いバージョンがページを制御している → 新バージョンがインストール済み、有効化待ち
            this.showUpdatePrompt();
          }
          // そうでなければ初回インストールなのでプロンプトは不要
        }
      });
    });

    // 制御権の変化を監視
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // 新しい Service Worker が引き継いだのでページをリロード
      window.location.reload();
    });

    // 1 時間ごとに更新をチェック
    setInterval(() => {
      this.registration?.update();
    }, 60 * 60 * 1000);
  }

  private showUpdatePrompt() {
    // 更新プロンプト UI を表示
    const toast = createUpdateToast({
      message: '新バージョンが利用可能です',
      actionText: 'リロード',
      onAction: () => this.skipWaiting(),
    });
    document.body.appendChild(toast);
  }

  private skipWaiting() {
    // 待機中の Service Worker に即座の有効化を通知
    this.registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Service Worker 側：skip waiting メッセージの受信
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

更新戦略の選択はアプリケーションのタイプに依存する：

- **コンテンツ型アプリ**：`registerType: 'prompt'` を使用し、ユーザーが自主的にリロードする
- **ツール型アプリ**：`registerType: 'autoUpdate'` を使用し、次回アクセス時に自動更新する
- **重要業務アプリ**：サーバー側 API と連携してバージョン互換性をチェックし、非互換時は強制更新する

## デバッグのコツ

Chrome DevTools の Application パネルは Service Worker をデバッグするためのコアツールである：

- **Service Workers リスト**：登録済み SW の状態確認、手動 unregister、update のトリガー
- **Cache Storage**：キャッシュ内容の確認、キャッシュエントリの手動削除
- **Offline / Update on reload / Bypass for network**：3 つのデバッグスイッチ
  - `Offline`：オフラインをシミュレート
  - `Update on reload`：毎回のリロードで SW を再インストール（開発時に必須）
  - `Bypass for network`：SW がリクエストをインターセプトせず、キャッシュ起因の問題の切り分けに便利
- **Push messages**：サーバーなしでプッシュをシミュレート

開発時によくある落とし穴：Service Worker のコードを変更しても反映されない。原因は `Update on reload` が有効になっておらず、古い SW が引き続きページを制御していることである。開発段階では常にこのオプションを有効にすること。

## App Shell モデルとの統合

App Shell モデルは PWA のアーキテクチャパターンの一つである：アプリケーションの「シェル」（ナビゲーションバー、サイドバー、レイアウトフレームワーク）を Service Worker にプレキャッシュし、初回読み込み後のアクセスでは瞬時にシェルを表示し、その後 JS で動的にコンテンツを充填する。

```typescript
// App Shell のナビゲーションルート処理
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async () => {
    // ナビゲーションリクエストはキャッシュされた app shell を返す
    const cache = await caches.open('app-shell');
    const cached = await cache.match('/shell.html');

    if (cached) {
      // バックグラウンドで shell を更新
      fetch('/shell.html').then((response) => {
        cache.put('/shell.html', response.clone());
      });
      return cached;
    }

    // 初回読み込み：ネットワークから取得
    const response = await fetch('/shell.html');
    cache.put('/shell.html', response.clone());
    return response;
  },
);
```

App Shell モデルは SPA で最も効果を発揮する——シェルの読み込み後はクライアントサイドルーティングが引き継ぎ、ページ遷移でネットワークリクエストが発生しない。ただし SSR アプリケーションでは App Shell の価値は限定的である。SSR 自体が既にファーストビューのコンテンツを高速に返せるからである。

## 2026 年における PWA の位置づけ

2026 年の PWA はもはや「ネイティブアプリの代替」というナラティブではなく、特定のシーンにおける最適解である：

- **内部ツールとエンタープライズアプリ**：App Store の審査が不要で、URL を直接配布できる
- **新興市場**：ローエンドデバイスと限られたネットワーク環境において、オフライン機能は必須要件
- **コンテンツ型アプリ**：ニュース、ブログ、ドキュメントサイトにおいて、オフラインリーディングは自然なニーズ
- **インストールハードルが高いシーン**：ユーザーが低頻度アプリのために App をインストールしたがらない

PWA が適さないシーン：大量のネイティブ API が必要（Bluetooth、NFC、ファイルシステムとの深い統合）、プッシュ通知の到達率が極めて高いことが要求される（iOS のプッシュは制限あり）、アプリストアの検索結果に表示される必要がある。

## まとめ

Service Worker とオフラインファーストアーキテクチャの中核は：キャッシュ戦略マトリクスを理解しリソース特性に応じて戦略を選択すること、Workbox でキャッシュ管理をエンジニアリングすること、Background Sync でデータの一貫性を保証すること、プッシュ通知でユーザーのリテンションを向上させること、そして合理的な更新フローを設計してユーザーにタイムリーに新バージョンを届けることである。2026 年における PWA の位置づけは、特定シーンにおける最適解であり、万能なソリューションではない——PWA を選択するのはネイティブアプリより優れているからではなく、その配布コスト、更新効率、オフライン能力が業務要件にちょうど合致するからである。Service Worker のライフサイクルとキャッシュ戦略を理解することが PWA を正しく実装する前提であり、デバッグのコツと更新戦略は本番環境での安定稼働を保障するものである。
