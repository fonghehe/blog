---
title: "前端錯誤邊界與降級策略：構建彈性應用"
date: 2026-08-05 19:30:18
tags:
  - 架構
readingTime: 7
description: "前端應用的彈性不只是捕獲錯誤，更是在錯誤發生後讓用戶依然能完成任務。本文從錯誤分類、框架級錯誤邊界、全局捕獲、降級策略設計、錯誤上報到灰度熔斷，系統梳理構建彈性前端應用的完整工程方案。"
wordCount: 3500
---

前端應用的穩定性不能只靠"不寫 Bug"來保證。隨着應用複雜度增長——動態加載、異步交互、第三方依賴、用戶環境多樣性——運行時錯誤不可避免。彈性架構的目標不是消滅所有錯誤，而是讓錯誤發生後用戶依然能完成任務，或者至少優雅地降級而非白屏。

## 前端錯誤的分類

有效的錯誤處理從正確的分類開始。前端的運行時錯誤可以分爲四類：

**JS 運行時錯誤**：類型錯誤、空引用、範圍錯誤等。這類錯誤是同步拋出的，`try-catch` 和 Error Boundary 都能捕獲。

**異步錯誤**：`setTimeout`、`setInterval`、事件回調中拋出的錯誤。它們不會冒泡到外層 `try-catch`，需要全局 `window.onerror` 捕獲。

**Promise rejection**：Promise 鏈中未被 `catch` 的 rejection。通過 `unhandledrejection` 事件捕獲。

**資源加載錯誤**：JS/CSS/圖片加載失敗。`<script onerror>` 或 `PerformanceObserver` 可以捕獲，但不會觸發 `window.onerror`。

```typescript
// 錯誤分類的完整捕獲體系
function setupGlobalErrorHandlers() {
  // 1. 同步運行時錯誤
  window.addEventListener('error', (event) => {
    reportError({
      type: 'runtime',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
    // 阻止默認的 console.error
    event.preventDefault();
  });

  // 2. Promise 未捕獲 rejection
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      type: 'promise_rejection',
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    });
    event.preventDefault();
  });

  // 3. 資源加載錯誤（捕獲階段）
  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG')) {
      reportError({
        type: 'resource_error',
        tagName: target.tagName,
        src: target.src || target.href,
      });
    }
  }, true); // 必須在捕獲階段監聽

  // 4. 跨域腳本錯誤（Script error）
  // 需要 <script crossorigin="anonymous"> + 服務端 CORS 頭配合
}
```

跨域腳本錯誤是一個常見的盲區——當加載跨域腳本時，瀏覽器出於安全考慮只返回 `"Script error."`，沒有堆棧信息。解決方式是給 `<script>` 標籤加 `crossorigin="anonymous"`，並確保 CDN 返回正確的 `Access-Control-Allow-Origin` 頭。

## React Error Boundary 的原理與局限

React 的 Error Boundary 是組件級的錯誤捕獲機制。當子組件樹在渲染、生命周期或構造函數中拋出錯誤時，Error Boundary 可以捕獲並顯示降級 UI。

```tsx
// components/ErrorBoundary.tsx
import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset);
      }
      return this.props.fallback ?? <DefaultFallback onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="error-fallback">
      <h3>這一塊內容出了點問題</h3>
      <button onClick={onRetry}>重試</button>
    </div>
  );
}
```

**Error Boundary 的關鍵局限**：它不捕獲異步錯誤、事件回調中的錯誤和 Promise rejection。下面這些錯誤會繞過 Error Boundary：

```tsx
function BuggyComponent() {
  // ❌ 不會被 Error Boundary 捕獲
  useEffect(() => {
    setTimeout(() => {
      throw new Error('async error');
    }, 1000);
  }, []);

  // ❌ 不會被 Error Boundary 捕獲
  const handleClick = async () => {
    await fetchData();
    throw new Error('event handler error');
  };

  // ✅ 會被 Error Boundary 捕獲（渲染期間拋出）
  const data = useSyncExternalStore(subscribe, getSnapshot);
  if (data === null) throw new Error('render error');

  return <button onClick={handleClick}>click</button>;
}
```

對於異步錯誤，需要在事件處理函數內部用 `try-catch`，或者用 React 19 的 `use()` Hook 配合 Suspense 和 Error Boundary 處理異步狀態。

**嵌套策略**：Error Boundary 不應該只有一個全局的。應該按路由、按組件區塊嵌套——導航欄崩潰不應該導致整個頁面白屏，側邊欄崩潰不應該影響主內容區。

```tsx
<App>
  <ErrorBoundary fallback={<NavFallback />}>
    <Navigation />
  </ErrorBoundary>
  <ErrorBoundary fallback={<RouteFallback />}>
    <Routes>
      <Route path="/dashboard" element={
        <ErrorBoundary fallback={<DashboardFallback />}>
          <Dashboard />
        </ErrorBoundary>
      } />
    </Routes>
  </ErrorBoundary>
</App>
```

## Vue 3 的錯誤捕獲機制

Vue 3 提供了 `onErrorCaptured` 和 `app.config.errorHandler` 兩個層級的錯誤處理。

```typescript
// Vue 3 的錯誤邊界組件
import { defineComponent, ref, onErrorCaptured, h } from 'vue';

export const ErrorBoundary = defineComponent({
  name: 'ErrorBoundary',
  props: {
    fallback: { type: Function, required: true },
  },
  setup(props, { slots }) {
    const error = ref<Error | null>(null);

    onErrorCaptured((err, instance, info) => {
      error.value = err;
      // 上報錯誤
      reportError({ type: 'vue_error', error: err, info });
      // 返回 false 阻止錯誤繼續向上傳播
      return false;
    });

    return () => {
      if (error.value) {
        return props.fallback(error.value, () => {
          error.value = null;
        });
      }
      return slots.default?.();
    };
  },
});
```

```typescript
// 全局錯誤處理器
// main.ts
import { createApp } from 'vue';
import App from './App.vue';

const app = createApp(App);

app.config.errorHandler = (err, instance, info) => {
  reportError({
    type: 'vue_global',
    error: err instanceof Error ? err : new Error(String(err)),
    componentName: instance?.$options.name,
    info,
  });
};

// 捕獲 Vue 內部的 warn（開發模式）
app.config.warnHandler = (msg, instance, trace) => {
  if (import.meta.env.DEV) {
    console.warn(`[Vue warn] ${msg}\n${trace}`);
  }
};

app.mount('#app');
```

Vue 的 `onErrorCaptured` 比 React Error Boundary 的覆蓋範圍更廣——它能捕獲組件內部事件處理函數和生命周期鉤子中的錯誤。但 `async setup()` 中的 rejection 仍需要手動處理。

## 降級策略設計：UI 降級、功能降級、數據降級

錯誤捕獲只是第一步，真正的彈性來自降級策略。降級分爲三個層級：

**UI 降級**——出錯的組件區域用簡化版 UI 替代。例如圖表組件崩潰時用表格替代，富文本編輯器崩潰時用純文本輸入框替代。

**功能降級**——核心功能不可用時，提供替代路徑。例如實時協作功能斷連時降級爲本地編輯 + 手動同步提示。

**數據降級**——新鮮數據獲取失敗時，使用緩存數據並標註"數據可能過期"。

```typescript
// 降級策略的組合使用
function useUserData(userId: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userApi.fetch(userId),
    // 數據降級：失敗時使用緩存
    retry: 2,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // 功能降級：API 不可用時使用本地數據
  const fallbackData = useLocalUserData(userId);

  const effectiveData = data ?? fallbackData.value;
  const isStale = !!error && !!data;

  return {
    data: effectiveData,
    isLoading,
    isStale, // 標記數據可能過期
    error,
  };
}
```

```tsx
// UI 降級：圖表 → 表格
function DataVisualization({ data }: { data: ChartData[] }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div>
          <p>圖表渲染失敗，已切換爲表格視圖</p>
          <DataTable data={data} />
          <button onClick={reset}>重試圖表</button>
        </div>
      )}
    >
      <ComplexChart data={data} />
    </ErrorBoundary>
  );
}
```

## 錯誤上報與聚合

錯誤捕獲後需要上報到監控平臺。Sentry 是最成熟的方案，但自建錯誤監控在數據隱私和定製化方面有優勢。

```typescript
// 上報器抽象
interface ErrorReporter {
  capture(error: ErrorInfo): void;
  setUser(user: { id: string; email?: string }): void;
  setContext(key: string, value: Record<string, unknown>): void;
}

// Sentry 實現
class SentryReporter implements ErrorReporter {
  constructor(dsn: string) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1, // 性能採樣 10%
      // 過濾噪音錯誤
      beforeSend(event) {
        // 過濾已知的無害錯誤
        if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
          return null;
        }
        return event;
      },
    });
  }

  capture(error: ErrorInfo) {
    Sentry.captureException(error.error, {
      tags: { type: error.type },
      extra: error.context,
    });
  }

  setUser(user) { Sentry.setUser(user); }
  setContext(key, value) { Sentry.setContext(key, value); }
}

// 自建上報實現
class CustomReporter implements ErrorReporter {
  private endpoint = '/api/errors';
  private queue: ErrorInfo[] = [];
  private flushTimer: number | null = null;

  capture(error: ErrorInfo) {
    this.queue.push({
      ...error,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
    });
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    // 批量上報，減少請求次數
    this.flushTimer = window.setTimeout(() => {
      const batch = this.queue.splice(0);
      this.flushTimer = null;

      // 使用 sendBeacon 確保頁面卸載時也能發出
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          this.endpoint,
          JSON.stringify({ errors: batch }),
        );
      } else {
        fetch(this.endpoint, {
          method: 'POST',
          body: JSON.stringify({ errors: batch }),
          keepalive: true,
        }).catch(() => {});
      }
    }, 5000);
  }

  setUser(user) { /* 存儲用戶上下文 */ }
  setContext(key, value) { /* 存儲額外上下文 */ }
}
```

上報時的**上下文信息**對排錯至關重要。一個有用的錯誤上報應該包含：用戶操作路徑（點擊了什麼、從哪個頁面來）、應用版本號、設備信息、最近的網絡請求狀態。這些上下文讓錯誤從"某個地方崩了"變成"用戶在 v2.3.1 版本、從首頁點擊購買按鈕後、支付接口返回 500 導致崩潰"。

## 灰度發布中的錯誤熔斷機制

灰度發布是發現生產環境問題的最後一道防線。熔斷機制在錯誤率超過閾值時自動停止發布流程：

```typescript
// 灰度發布熔斷檢查器
interface ReleaseHealth {
  errorRate: number;
  crashRate: number;
  sampleSize: number;
}

class ReleaseCircuitBreaker {
  private thresholds = {
    errorRate: 0.05,      // 錯誤率 > 5% 觸發熔斷
    crashRate: 0.01,      // 崩潰率 > 1% 觸發熔斷
    minSampleSize: 100,   // 至少 100 個樣本才有統計意義
  };

  async checkReleaseHealth(
    version: string,
    rolloutPercentage: number,
  ): Promise<{ shouldHalt: boolean; reason?: string }> {
    const health = await this.fetchHealthMetrics(version);

    if (health.sampleSize < this.thresholds.minSampleSize) {
      return { shouldHalt: false }; // 樣本不足，繼續觀察
    }

    if (health.errorRate > this.thresholds.errorRate) {
      return {
        shouldHalt: true,
        reason: `錯誤率 ${(health.errorRate * 100).toFixed(1)}% 超過閾值 ${this.thresholds.errorRate * 100}%`,
      };
    }

    if (health.crashRate > this.thresholds.crashRate) {
      return {
        shouldHalt: true,
        reason: `崩潰率 ${(health.crashRate * 100).toFixed(1)}% 超過閾值 ${this.thresholds.crashRate * 100}%`,
      };
    }

    return { shouldHalt: false };
  }

  private async fetchHealthMetrics(version: string): Promise<ReleaseHealth> {
    // 從錯誤監控平臺查詢該版本的錯誤指標
    const stats = await fetch(`/api/release-stats?version=${version}`).then(
      (r) => r.json(),
    );
    return {
      errorRate: stats.errors / stats.total,
      crashRate: stats.crashes / stats.total,
      sampleSize: stats.total,
    };
  }
}
```

## Source Map 還原生產環境錯誤堆棧

生產環境通常上傳壓縮後的 JS，錯誤堆棧中只有壓縮後的行列號。Source Map 能把壓縮後的位置映射回源碼，但 Source Map 文件不能暴露給公網（等於泄露源碼）。

標準做法是構建時生成 Source Map 但不部署到 CDN，而是上傳到錯誤監控平臺：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: 'hidden', // 生成 source map 但不在 JS 中引用
  },
});

// CI 中上傳 source map 到 Sentry
// .github/workflows/deploy.yml
// - name: Upload source maps to Sentry
//   run: npx sentry-cli sourcemaps upload --release=$VERSION dist/
//   env:
//     SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
// - name: Delete source maps after upload
//   run: rm -rf dist/**/*.map
```

`hidden` 模式生成 Source Map 但不在打包產物中添加 `//# sourceMappingURL=` 注釋。這樣瀏覽器不會自動下載 Source Map，但 Sentry 可以用上傳的文件做堆棧還原。

## 彈性架構的設計原則

1. **失敗是常態**——設計時假設任何環節都可能失敗：API 超時、組件崩潰、資源加載失敗。每個失敗點都應有對應的降級方案。
2. **爆炸半徑最小化**——用細粒度的 Error Boundary 隔離故障區域，一個組件崩潰不影響其他區域。路由級、區塊級、組件級三層嵌套。
3. **降級優於報錯**——用戶看到降級 UI 比看到錯誤彈窗體驗更好。能用緩存數據就不用空白，能用簡化 UI 就不顯示錯誤。
4. **可觀測性**——每個錯誤都應該被上報、聚合、歸類。沒有可觀測性的錯誤處理等於沒有處理。
5. **漸進恢復**——提供"重試"按鈕讓用戶主動恢復，而不是要求刷新整個頁面。

## 小結

構建彈性前端應用是一個系統工程：從錯誤分類出發建立完整的捕獲體系（Error Boundary + 全局監聽 + 資源錯誤），設計三級降級策略（UI/功能/數據），搭建錯誤上報與聚合管道，配置 Source Map 還原生產堆棧，用灰度熔斷守衛發布安全。核心思想是接受錯誤必然發生，但通過隔離、降級和恢復機制讓用戶在錯誤環境下依然能完成任務。彈性不是事後補救，而是架構設計時就需要內建的能力。
