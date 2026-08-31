---
title: "Pinia 大型項目狀態管理：模塊化設計與持久化策略"
date: 2026-08-02 16:27:05
tags:
  - Vue
readingTime: 10
description: "Pinia 在大型項目中面臨的挑戰不是 API 用法，而是架構設計：Store 如何按功能域拆分、跨 Store 依賴如何管理、狀態持久化如何兼顧性能與一致性、SSR 場景下的 hydration 如何處理。本文從實際項目經驗出發，系統梳理 Pinia 大型項目的狀態管理架構。"
wordCount: 1972
---

Pinia 作爲 Vue 官方推薦的狀態管理庫，API 簡潔、TypeScript 友好、Devtools 集成完善。在中小型項目中，幾乎不需要太多架構思考就能用好。但當項目規模增長到幾十個頁面、上百個 API 接口、多個業務團隊並行開發時，Pinia 的使用方式需要從"寫 Store"升級到"設計 Store 架構"。

## 大型項目中的 Store 架構設計

大型項目的狀態管理問題，本質上不是 Pinia 的 API 問題，而是**狀態歸屬問題**——哪些狀態該放 Store、哪些該放組件本地、哪些該放服務端緩存。一個常見的錯誤是把所有狀態都塞進 Store，導致 Store 膨脹、組件失去自主性、不必要的全局響應式開銷。

狀態歸屬的判斷原則：

- **服務端數據的緩存**：多個組件共享的列表/詳情數據放 Store，配合請求去重
- **跨頁面共享的用戶態**：登錄信息、權限、偏好設置放 Store
- **頁面級 UI 狀態**：當前打開的 Tab、表單草稿放 Store（支持頁面切換恢復）
- **組件內部狀態**：彈窗開關、輸入框聚焦等放組件本地 `ref`/`reactive`
- **派生數據**：用 `computed` 或 getters，不要存儲可計算的數據

## Store 的模塊化拆分：按功能域 vs 按頁面

拆分 Store 有兩種常見策略：按功能域（domain）或按頁面（page）。

按頁面拆分的問題在於頁面邊界不穩定——產品迭代會合併、拆分頁面，而且跨頁面的共享狀態（如用戶信息）沒有自然歸屬。

按功能域拆分更合理。功能域是業務概念的邊界，比頁面穩定。例如一個電商平臺可以按"用戶域"、"商品域"、"訂單域"、"支付域"拆分 Store，每個域內部再細分。

```typescript
// stores/domain/user/index.ts
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { useProfileStore } from './profile';
import { usePermissionStore } from './permission';

// 域級聚合 Store：對外暴露統一入口
export function useUserDomain() {
  const auth = useAuthStore();
  const profile = useProfileStore();
  const permission = usePermissionStore();

  return {
    auth,
    profile,
    permission,
    // 域級派生狀態
    isLoggedIn: () => auth.token !== null,
    canAccess: (resource: string) => permission.check(resource),
  };
}
```

```typescript
// stores/domain/user/auth.ts - 認證 Store
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

每個功能域內部，Store 保持在 100-200 行以內。如果一個 Store 超過這個規模，說明需要進一步拆分——通常可以按讀操作和寫操作分離，或者按實體類型拆分。

## 跨 Store 依賴管理：組合 vs 繼承

大型項目中 Store 之間必然存在依賴關係。用戶訂單 Store 需要讀取用戶信息 Store，權限 Store 依賴認證 Store 的 token。Pinia 處理跨 Store 依賴的方式是**組合**——在一個 Store 內部調用另一個 Store。

```typescript
// stores/domain/order/list.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from '../user/auth';
import { usePermissionStore } from '../user/permission';
import { orderApi } from '@/api/order';

export const useOrderListStore = defineStore('order-list', () => {
  // 組合其他 Store
  const auth = useAuthStore();
  const permission = usePermissionStore();

  const orders = ref<Order[]>([]);
  const loading = ref(false);
  const filter = ref<OrderFilter>({ status: 'all' });

  const visibleOrders = computed(() => {
    if (permission.canViewAllOrders()) {
      return orders.value;
    }
    // 普通用戶只能看到自己的訂單
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

組合模式的關鍵注意事項：

1. **避免循環依賴**：Store A 依賴 Store B，Store B 又依賴 Store A，這會導致初始化時的無限遞歸。如果發現循環依賴，說明職責劃分有問題，需要提取共享邏輯到第三個 Store。
2. **延遲初始化**：在 Setup Store 中調用 `useXxxStore()` 是安全的，Pinia 會確保被依賴的 Store 在使用時已初始化。但在 Store 的頂層（模塊加載時）不要直接調用——應在 setup 函數內部調用。
3. **依賴最小化**：一個 Store 依賴的 Store 數量最好不超過 2-3 個。如果依賴鏈太長，說明 Store 耦合度過高。

## 狀態持久化方案：localStorage / IndexedDB / 服務端同步

狀態持久化的需求場景：刷新頁面後保持登錄態、離線場景緩存數據、跨 Tab 同步狀態。不同場景需要不同的持久化策略。

**登錄態持久化**——安全敏感數據用 sessionStorage 或 HttpOnly Cookie，不要放 localStorage：

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

  // 恢復持久化數據
  const stored = localStorage.getItem(`pinia:${store.$id}`);
  if (stored) {
    const parsed = JSON.parse(stored);
    keys.forEach((key) => {
      if (key in parsed) store[key] = parsed[key];
    });
  }

  // 監聽變化並持久化
  store.$subscribe((mutation, state) => {
    const toPersist: Record<string, unknown> = {};
    keys.forEach((key) => {
      toPersist[key] = state[key];
    });
    localStorage.setItem(`pinia:${store.$id}`, JSON.stringify(toPersist));
  });
}
```

**大量數據緩存**——如商品列表、聊天記錄，localStorage 的 5MB 限制不夠用，需要 IndexedDB：

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

**跨 Tab 同步**——用 BroadcastChannel 實現多 Tab 間的狀態同步：

```typescript
// plugins/cross-tab-sync.ts
export function crossTabSyncPlugin({ store }: PiniaPluginContext) {
  if (typeof window === 'undefined') return;
  if (!('BroadcastChannel' in window)) return;

  const channel = new BroadcastChannel(`pinia:${store.$id}`);

  // 接收其他 Tab 的狀態更新
  channel.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === 'sync') {
      store.$patch(payload);
    }
  };

  // 廣播狀態變化
  store.$subscribe((mutation, state) => {
    channel.postMessage({ type: 'sync', payload: state });
  });
}
```

## SSR 友好的狀態管理：Hydration 與狀態序列化

Nuxt 3 / SSR 場景下，Pinia 需要處理服務端預取數據 → 序列化到 HTML → 客戶端 hydration 的完整鏈路。核心是確保客戶端的初始狀態與服務端一致，避免 hydration mismatch。

```typescript
// Nuxt 3 中的 SSR 狀態處理
// server/plugins/pinia-ssr.ts
import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:created', async () => {
    const pinia = nuxtApp.$pinia;

    // 在服務端預取關鍵數據
    const authStore = useAuthStore(pinia);
    if (nuxtApp.ssrContext?.event.req.headers.cookie) {
      await authStore.initFromCookie(nuxtApp.ssrContext.event.req.headers.cookie);
    }

    const preferenceStore = usePreferenceStore(pinia);
    await preferenceStore.fetchPreferences();
  });
});

// 客戶端 hydration
// Nuxt 自動處理 state 序列化，但需要確保 Store 是 SSR 友好的
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);

  // 避免在 Store 頂層訪問 window/document
  // 這些 API 只在客戶端可用
  function initFromCookie(cookie: string) {
    const match = cookie.match(/auth_token=([^;]+)/);
    token.value = match ? match[1] : null;
  }

  return { token, initFromCookie };
});
```

SSR 中最常見的坑是 Store 中直接調用了瀏覽器 API（如 `window.localStorage`）。解決方式是用 `import.meta.server` / `import.meta.client` 做環境判斷，或者把瀏覽器 API 訪問延遲到 `onMounted` 中。

## Devtools 集成與調試技巧

Pinia Devtools 提供了時間旅行調試、狀態快照、action 追蹤等能力。在大型項目中，幾個實用的調試技巧：

**$onAction 訂閱**——在不修改 Store 代碼的情況下添加 action 日誌：

```typescript
// 開發環境下的 action 追蹤
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

**$reset 狀態重置**——測試和路由切換時恢復 Store 到初始狀態。Setup Store 默認不支持 `$reset`，需要手動實現：

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

## 性能優化：避免不必要的響應式追蹤

大型項目中 Store 的性能問題通常不是來自 Pinia 本身，而是來自不合理的響應式使用。

**大數組只讀場景**：如果一個數組數據只用於渲染、不需要響應式追蹤內部屬性變化，用 `shallowRef` 替代 `ref`，避免對數組每個元素做深度響應式轉換：

```typescript
export const useProductListStore = defineStore('product-list', () => {
  // shallowRef：只追蹤 .value 的替換，不追蹤內部屬性變化
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

**computed 緩存策略**：對於計算成本高的派生數據，確保 computed 的依賴最小化。如果一個 computed 依賴了整個大數組但只用了其中幾個字段，考慮先把需要的字段提取出來：

```typescript
// 不理想：依賴整個 orders 數組
const totalAmount = computed(() =>
  orders.value.reduce((sum, o) => sum + o.amount, 0),
);

// 更好：依賴提取出的金額數組，數組替換時才重算
const orderAmounts = computed(() => orders.value.map((o) => o.amount));
const totalAmount = computed(() =>
  orderAmounts.value.reduce((sum, a) => sum + a, 0),
);
```

實際上，第二種寫法在 orders 數組元素屬性變化時不會觸發重算（因爲 `map` 產生新數組），這在某些場景下是優勢。但如果 orders 內部頻繁變化，第一種寫法更安全。需要根據實際場景權衡。

## 與 Vuex 的遷移經驗

從 Vuex 遷移到 Pinia 的項目，最大的收益不是 API 更簡潔，而是**架構約束的變化**。Vuex 的單一 Store 樹容易導致"全局狀態垃圾桶"——所有模塊都往一個 Store 裏塞數據。Pinia 的多 Store 模型天然鼓勵按功能域拆分，狀態歸屬更清晰。

遷移策略建議分步進行：

1. 新功能直接用 Pinia，不碰 Vuex
2. 用 `pinia-composition` 橋接層讓 Pinia Store 讀取 Vuex 狀態
3. 按功能域逐步遷移，每次遷移一個域並刪除對應 Vuex module
4. 最後移除 Vuex 依賴

不要做"大爆炸"式遷移——一次性替換所有 Store 的風險太高，且無法逐步驗證。

## 最佳實踐與常見陷阱

**陷阱 1：Store 裏放太多 UI 狀態。** 彈窗開關、表單臨時狀態不應該放 Store——它們的生命周期和組件一致，放 Store 只會增加複雜度而沒有復用價值。判斷標準：如果這個狀態只有一個組件用，不要放 Store。

**陷阱 2：在 Store 中直接做 API 請求而不處理競態。** 快速切換頁面時，舊請求可能在新請求之後返回，導致數據覆蓋。用 AbortController 或請求 ID 做競態控制：

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

**陷阱 3：過度使用 $patch 批量更新。** `$patch` 適合批量更新多個不相關字段，但如果更新邏輯有依賴關係（如先設置 A 再根據 A 計算 B），應該用 action 函數保證邏輯清晰。

## 小結

Pinia 在大型項目中的架構設計核心是：按功能域拆分 Store、用組合模式管理跨 Store 依賴、根據數據特性選擇持久化方案（localStorage for 小數據、IndexedDB for 大數據、BroadcastChannel for 跨 Tab）、SSR 場景注意 hydration 一致性、用 shallowRef 和合理 computed 優化性能。狀態管理沒有銀彈——關鍵是理解每個狀態的生命周期和訪問模式，讓架構服務於業務而非反之。從 Vuex 遷移時分步進行，新功能先行，老功能按域逐步切換，降低風險的同時讓團隊逐步適應新的架構模式。
