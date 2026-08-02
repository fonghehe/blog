---
title: "Pinia 大規模プロジェクトの状態管理：モジュール設計と永続化戦略"
date: 2026-08-02 16:27:05
tags:
  - Vue
readingTime: 7
description: "Pinia が大規模プロジェクトで直面する課題は API の使い方ではなく、アーキテクチャ設計である：Store の機能ドメイン別分割、クロス Store 依存の管理、状態永続化でパフォーマンスと一貫性を両立させる方法、SSR シーンでの hydration 処理。本記事は実際のプロジェクト経験から、Pinia 大規模プロジェクトの状態管理アーキテクチャを体系的に整理する。"
wordCount: 3400
---

Pinia は Vue 公式推奨の状態管理ライブラリであり、API がシンプルで TypeScript に優しく、Devtools 統合も充実している。中小規模プロジェクトではほぼアーキテクチャ上の思考をしなくてもうまく使える。しかしプロジェクト規模が数十ページ、上百の API インターフェース、複数の業務チームが並行開発するまで成長すると、Pinia の使い方は「Store を書く」から「Store アーキテクチャを設計する」へとアップグレードする必要がある。

## 大規模プロジェクトにおける Store アーキテクチャ設計

大規模プロジェクトの状態管理の課題は本質的に Pinia の API の問題ではなく、**状態の帰属問題**である——どの状態を Store に置くべきか、どの状態をコンポーネントローカルに置くべきか、どの状態をサーバーキャッシュに置くべきか。よくある間違いはすべての状態を Store に詰め込み、Store が膨張し、コンポーネントが自主性を失い、不要なグローバルリアクティブオーバーヘッドを生むことである。

状態帰属の判断原則：

- **サーバーデータのキャッシュ**：複数コンポーネントで共有するリスト/詳細データは Store に置き、リクエストの重複排除を組み合わせる
- **クロスページ共有のユーザー状態**：ログイン情報、権限、プリファレンス設定は Store に置く
- **ページレベル UI 状態**：現在開いている Tab、フォームの下書きは Store に置く（ページ切り替え時の復元をサポート）
- **コンポーネント内部状態**：モーダルの開閉、入力フィールドのフォーカスなどはコンポーネントローカルの `ref`/`reactive` に置く
- **派生データ**：`computed` や getters を使用し、計算可能なデータを保存しない

## Store のモジュール分割：機能ドメイン別 vs ページ別

Store の分割には二つの一般的な戦略がある：機能ドメイン（domain）別かページ（page）別か。

ページ別分割の問題はページ境界が不安定なことである——プロダクトのイテレーションでページが統合・分割され、またクロスページの共有状態（ユーザー情報など）に自然な帰属先がない。

機能ドメイン別分割がより合理的である。機能ドメインは業務概念の境界であり、ページより安定している。例えば EC プラットフォームでは「ユーザードメイン」「商品ドメイン」「注文ドメイン」「決済ドメイン」で Store を分割し、各ドメイン内部でさらに細分化できる。

```typescript
// stores/domain/user/index.ts
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { useProfileStore } from './profile';
import { usePermissionStore } from './permission';

// ドメインレベル集約 Store：外部に統一エントリを提供
export function useUserDomain() {
  const auth = useAuthStore();
  const profile = useProfileStore();
  const permission = usePermissionStore();

  return {
    auth,
    profile,
    permission,
    // ドメインレベル派生状態
    isLoggedIn: () => auth.token !== null,
    canAccess: (resource: string) => permission.check(resource),
  };
}
```

```typescript
// stores/domain/user/auth.ts - 認証 Store
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const expiresAt = ref<number>(0);

  const isAuthenticated = computed(() => {
    return token.value !== null && Date.now() < expiresAt.value;
  });

  async function login(credentials: LoginCredentials) {
    const result = await authApi.login(credentials);
    token.value = result.accessToken;
    refreshToken.value = result.refreshToken;
    expiresAt.value = Date.now() + result.expiresIn * 1000;
  }

  async function refresh() {
    if (!refreshToken.value) throw new Error('No refresh token');
    const result = await authApi.refresh(refreshToken.value);
    token.value = result.accessToken;
    expiresAt.value = Date.now() + result.expiresIn * 1000;
  }

  function logout() {
    token.value = null;
    refreshToken.value = null;
    expiresAt.value = 0;
  }

  return { token, isAuthenticated, login, refresh, logout };
});
```

各機能ドメイン内部で、Store は 100-200 行以内に保つべきである。一つの Store がこの規模を超える場合、さらに分割が必要である——通常は読み取り操作と書き込み操作の分離、またはエンティティタイプ別の分割ができる。

## クロス Store 依存管理：コンポジション vs 継承

大規模プロジェクトでは Store 間に必然的に依存関係が生まれる。ユーザー注文 Store はユーザー情報 Store を読み取る必要があり、権限 Store は認証 Store の token に依存する。Pinia がクロス Store 依存を処理する方式は**コンポジション**である——一つの Store 内部で別の Store を呼び出す。

```typescript
// stores/domain/order/list.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from '../user/auth';
import { usePermissionStore } from '../user/permission';
import { orderApi } from '@/api/order';

export const useOrderListStore = defineStore('order-list', () => {
  // 他の Store をコンポジション
  const auth = useAuthStore();
  const permission = usePermissionStore();

  const orders = ref<Order[]>([]);
  const loading = ref(false);
  const filter = ref<OrderFilter>({ status: 'all' });

  const visibleOrders = computed(() => {
    if (permission.canViewAllOrders()) {
      return orders.value;
    }
    // 一般ユーザーは自分の注文のみ閲覧可能
    return orders.value.filter((o) => o.userId === auth.userId);
  });

  async function fetchOrders() {
    if (!auth.isAuthenticated) return;

    loading.value = true;
    try {
      orders.value = await orderApi.list({
        filter: filter.value,
        token: auth.token!,
      });
    } finally {
      loading.value = false;
    }
  }

  return { orders, visibleOrders, loading, filter, fetchOrders };
});
```

コンポジションパターンの重要な注意事項：

1. **循環依存を避ける**：Store A が Store B に依存し、Store B が Store A に依存すると、初期化時の無限再帰を引き起こす。循環依存を発見した場合、責務の分割に問題があり、共有ロジックを第三の Store に抽出する必要がある。
2. **遅延初期化**：Setup Store で `useXxxStore()` を呼び出すのは安全である。Pinia は依存される Store が使用時に初期化済みであることを保証する。ただし Store のトップレベル（モジュールロード時）で直接呼び出してはいけない——setup 関数内部で呼び出すべきである。
3. **依存の最小化**：一つの Store が依存する Store 数は 2-3 個を超えないのが良い。依存チェーンが長すぎる場合、Store の結合度が高すぎることを示す。

## 状態永続化方案：localStorage / IndexedDB / サーバー同期

状態永続化のニーズシーン：ページリフレッシュ後のログイン状態維持、オフラインシーンでのデータキャッシュ、クロスタブの状態同期。異なるシーンで異なる永続化戦略が必要である。

**ログイン状態の永続化**——セキュリティ機密データは sessionStorage や HttpOnly Cookie を使用し、localStorage には置かない：

```typescript
// plugins/persist-auth.ts
import type { PiniaPluginContext } from 'pinia';

const PERSIST_KEYS: Record<string, string[]> = {
  auth: ['token', 'refreshToken', 'expiresAt'],
  preference: ['theme', 'language', 'sidebarCollapsed'],
};

export function persistPlugin({ store }: PiniaPluginContext) {
  const keys = PERSIST_KEYS[store.$id];
  if (!keys) return;

  // 永続化データの復元
  const stored = localStorage.getItem(`pinia:${store.$id}`);
  if (stored) {
    const parsed = JSON.parse(stored);
    keys.forEach((key) => {
      if (key in parsed) store[key] = parsed[key];
    });
  }

  // 変更を監視して永続化
  store.$subscribe((mutation, state) => {
    const toPersist: Record<string, unknown> = {};
    keys.forEach((key) => {
      toPersist[key] = state[key];
    });
    localStorage.setItem(`pinia:${store.$id}`, JSON.stringify(toPersist));
  });
}
```

**大量データのキャッシュ**——商品リスト、チャット履歴など、localStorage の 5MB 制限では足りず、IndexedDB が必要：

```typescript
// utils/idb-persist.ts
import { openDB, type IDBPDatabase } from 'idb';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('app-cache', 1, {
      upgrade(db) {
        db.createObjectStore('stores', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function persistToIDB(key: string, data: unknown) {
  const db = await getDB();
  await db.put('stores', { id: key, data, timestamp: Date.now() });
}

export async function loadFromIDB(key: string, maxAge = 5 * 60 * 1000) {
  const db = await getDB();
  const record = await db.get('stores', key);
  if (!record) return null;
  if (Date.now() - record.timestamp > maxAge) {
    await db.delete('stores', key);
    return null;
  }
  return record.data;
}
```

**クロスタブ同期**——BroadcastChannel で複数タブ間の状態同期を実現：

```typescript
// plugins/cross-tab-sync.ts
export function crossTabSyncPlugin({ store }: PiniaPluginContext) {
  if (typeof window === 'undefined') return;
  if (!('BroadcastChannel' in window)) return;

  const channel = new BroadcastChannel(`pinia:${store.$id}`);

  // 他タブからの状態更新を受信
  channel.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === 'sync') {
      store.$patch(payload);
    }
  };

  // 状態変化をブロードキャスト
  store.$subscribe((mutation, state) => {
    channel.postMessage({ type: 'sync', payload: state });
  });
}
```

## SSR に優しい状態管理：Hydration と状態のシリアライズ

Nuxt 3 / SSR シーンでは、Pinia はサーバー側のデータ事前取得 → HTML へのシリアライズ → クライアントの hydration の完全な経路を処理する必要がある。中核はクライアントの初期状態がサーバー側と一致することを確保し、hydration mismatch を回避することである。

```typescript
// Nuxt 3 での SSR 状態処理
// server/plugins/pinia-ssr.ts
import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:created', async () => {
    const pinia = nuxtApp.$pinia;

    // サーバー側で主要データを事前取得
    const authStore = useAuthStore(pinia);
    if (nuxtApp.ssrContext?.event.req.headers.cookie) {
      await authStore.initFromCookie(nuxtApp.ssrContext.event.req.headers.cookie);
    }

    const preferenceStore = usePreferenceStore(pinia);
    await preferenceStore.fetchPreferences();
  });
});

// クライアントの hydration
// Nuxt が自動的に state のシリアライズを処理するが、Store が SSR に優しいことを確保する必要がある
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);

  // Store のトップレベルで window/document にアクセスしない
  // これらの API はクライアント側でのみ利用可能
  function initFromCookie(cookie: string) {
    const match = cookie.match(/auth_token=([^;]+)/);
    token.value = match ? match[1] : null;
  }

  return { token, initFromCookie };
});
```

SSR で最もよくある落とし穴は Store 内で直接ブラウザ API（`window.localStorage` など）を呼び出すことである。解決方法は `import.meta.server` / `import.meta.client` で環境判定するか、ブラウザ API へのアクセスを `onMounted` まで遅延させることである。

## Devtools 統合とデバッグテクニック

Pinia Devtools はタイムトラベルデバッグ、状態スナップショット、action トラッキングなどの能力を提供する。大規模プロジェクトで役立つデバッグテクニックをいくつか紹介する：

**$onAction サブスクリプション**——Store コードを修正せずに action ログを追加：

```typescript
// 開発環境での action トラッキング
if (import.meta.env.DEV) {
  const pinia = getActivePinia()!;
  pinia.use(({ store }) => {
    store.$onAction(({ name, args, after, onError }) => {
      const startTime = Date.now();
      console.log(`[${store.$id}] ${name}() called`, args);

      after((result) => {
        console.log(`[${store.$id}] ${name}() done in ${Date.now() - startTime}ms`);
      });

      onError((error) => {
        console.error(`[${store.$id}] ${name}() failed`, error);
      });
    });
  });
}
```

**$reset 状態リセット**——テストやルート切り替え時に Store を初期状態に戻す。Setup Store はデフォルトで `$reset` をサポートしないため、手動実装が必要：

```typescript
export const useOrderListStore = defineStore('order-list', () => {
  const orders = ref<Order[]>([]);
  const filter = ref<OrderFilter>({ status: 'all' });

  function $reset() {
    orders.value = [];
    filter.value = { status: 'all' };
  }

  return { orders, filter, $reset };
});
```

## パフォーマンス最適化：不要なリアクティブトラッキングの回避

大規模プロジェクトでの Store のパフォーマンス問題は通常 Pinia 自体ではなく、不合理なリアクティブ使用に起因する。

**大配列の読み取り専用シーン**：配列データがレンダリングにしか使われず、内部プロパティ変化のリアクティブトラッキングが不要な場合、`ref` の代わりに `shallowRef` を使用し、配列の各要素に対する深いリアクティブ変換を回避する：

```typescript
export const useProductListStore = defineStore('product-list', () => {
  // shallowRef：.value の置換のみトラッキング、内部プロパティ変化はトラッキングしない
  const products = shallowRef<Product[]>([]);
  const loading = ref(false);

  async function fetchProducts() {
    loading.value = true;
    try {
      products.value = await productApi.list();
    } finally {
      loading.value = false;
    }
  }

  return { products, loading, fetchProducts };
});
```

**computed のキャッシュ戦略**：計算コストの高い派生データでは、computed の依存を最小化することが重要。ある computed が大配列全体に依存しつつ数個のフィールドしか使わない場合、必要なフィールドを先に抽出することを検討する：

```typescript
// 非理想的：orders 配列全体に依存
const totalAmount = computed(() =>
  orders.value.reduce((sum, o) => sum + o.amount, 0),
);

// より良い：抽出した金額配列に依存、配列の置換時のみ再計算
const orderAmounts = computed(() => orders.value.map((o) => o.amount));
const totalAmount = computed(() =>
  orderAmounts.value.reduce((sum, a) => sum + a, 0),
);
```

実際には、二つ目の書き方は orders 配列の要素プロパティ変化時に再計算をトリガーしない（`map` が新配列を生成するため）。これは一部のシーンでは利点となる。ただし orders 内部が頻繁に変化する場合は、一つ目の書き方がより安全である。実際のシーンに応じて判断が必要である。

## Vuex からの移行経験

Vuex から Pinia への移行プロジェクトで最大のメリットは API の簡潔さではなく、**アーキテクチャ制約の変化**である。Vuex の単一 Store ツリーは「グローバル状態のゴミ箱」を生みやすい——すべてのモジュールが一つの Store にデータを詰め込む。Pinia のマルチ Store モデルは機能ドメイン別分割を自然に促し、状態の帰属がより明確になる。

移行戦略は段階的に進めることを推奨する：

1. 新機能は直接 Pinia を使用し、Vuex には触らない
2. `pinia-composition` ブリッジ層で Pinia Store から Vuex 状態を読み取る
3. 機能ドメインごとに段階的に移行し、毎回一つのドメインを移行して対応する Vuex module を削除
4. 最後に Vuex の依存を削除

「ビッグバン」式の移行は行わないべきである——全 Store を一括置換するリスクが高すぎ、段階的に検証できない。

## ベストプラクティスとよくある落とし穴

**落とし穴 1：Store に UI 状態を入れすぎる。** モーダルの開閉、フォームの一時状態は Store に置くべきではない——これらのライフサイクルはコンポーネントと一致しており、Store に置くと複雑さが増すだけで再利用価値がない。判断基準：その状態を使うコンポーネントが一つしかない場合、Store に置かない。

**落とし穴 2：Store 内で直接 API リクエストをしつつ競合を処理しない。** ページをすばやく切り替える際、古いリクエストが新しいリクエストより後に返わり、データが上書きされる可能性がある。AbortController やリクエスト ID で競合制御を行う：

```typescript
let fetchController: AbortController | null = null;

async function fetchOrders() {
  fetchController?.abort();
  fetchController = new AbortController();

  try {
    orders.value = await orderApi.list({
      signal: fetchController.signal,
    });
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      throw e;
    }
  }
}
```

**落とし穴 3：$patch の過度な使用。** `$patch` は関連しない複数フィールドのバッチ更新に適するが、更新ロジックに依存関係がある場合（A を設定してから A に基づいて B を計算するなど）、action 関数でロジックの明確さを保証すべきである。

## まとめ

Pinia の大規模プロジェクトにおけるアーキテクチャ設計の中核は：機能ドメイン別に Store を分割し、コンポジションパターンでクロス Store 依存を管理し、データ特性に応じて永続化方案を選択し（小データには localStorage、大データには IndexedDB、クロスタブには BroadcastChannel）、SSR シーンでは hydration の一貫性に注意し、shallowRef と合理的な computed でパフォーマンスを最適化することである。状態管理に銀の弾丸はない——重要なのは各状態のライフサイクルとアクセスパターンを理解し、アーキテクチャが業務に奉仕するようにすること而非その逆であることである。Vuex からの移行は段階的に行い、新機能を先行させ、旧機能をドメインごとに順次切り替えることで、リスクを下げながらチームが新しいアーキテクチャパターンに段階的に慣れるようにする。
