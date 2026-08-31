---
title: "フロントエンドのエラー境界とフォールバック戦略：レジリエントアプリケーションの構築"
date: 2026-08-05 19:30:18
tags:
  - アーキテクチャ
readingTime: 12
description: "フロントエンドアプリケーションのレジリエンスはエラーを捕捉することだけでなく、エラー発生後もユーザーがタスクを完了できるようにすることにある。本記事はエラー分類、フレームワークレベルのエラー境界、グローバルキャッチ、フォールバック戦略設計、エラー報告から段階的リリースのサーキットブレーカーまで、レジリエントなフロントエンドアプリケーションを構築する完全なエンジニアリング方案を体系的に整理する。"
wordCount: 2680
---

フロントエンドアプリケーションの安定性は「バグを書かないこと」だけでは保証できない。アプリケーションの複雑化に伴い——動的ロード、非同期インタラクション、サードパーティ依存、ユーザー環境の多様性——ランタイムエラーは不可避である。レジリエントアーキテクチャの目標はすべてのエラーを消滅させることではなく、エラー発生後もユーザーがタスクを完了できるようにするか、少なくとも優雅にフォールバックして、白画面を回避することである。

## フロントエンドエラーの分類

効果的なエラーハンドリングは正しい分類から始まる。フロントエンドのランタイムエラーは四つに分類できる：

**JS ランタイムエラー**：型エラー、null 参照、範囲エラーなど。これらのエラーは同期的にスローされ、`try-catch` と Error Boundary で捕捉できる。

**非同期エラー**：`setTimeout`、`setInterval`、イベントコールバックでスローされたエラー。これらは外側の `try-catch` にバブルアップせず、グローバル `window.onerror` で捕捉する必要がある。

**Promise rejection**：Promise チェーンで `catch` されなかった rejection。`unhandledrejection` イベントで捕捉する。

**リソースロードエラー**：JS/CSS/画像のロード失敗。`<script onerror>` や `PerformanceObserver` で捕捉できるが、`window.onerror` はトリガーされない。

```typescript
// エラー分類の完全な捕捉体系
function setupGlobalErrorHandlers() {
  // 1. 同期ランタイムエラー
  window.addEventListener('error', (event) => {
    reportError({
      type: 'runtime',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
    // デフォルトの console.error を抑制
    event.preventDefault();
  });

  // 2. Promise の未キャッチ rejection
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      type: 'promise_rejection',
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    });
    event.preventDefault();
  });

  // 3. リソースロードエラー（キャプチャフェーズ）
  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG')) {
      reportError({
        type: 'resource_error',
        tagName: target.tagName,
        src: target.src || target.href,
      });
    }
  }, true); // キャプチャフェーズでリスニング必須

  // 4. クロスオリジンスクリプトエラー（Script error）
  // <script crossorigin="anonymous"> + サーバー側 CORS ヘッダーの連携が必要
}
```

クロスオリジンスクリプトエラーはよくある盲点である——クロスオリジンスクリプトをロードする際、ブラウザはセキュリティ上の理由から `"Script error."` しか返さず、スタック情報がない。解決方法は `<script>` タグに `crossorigin="anonymous"` を追加し、CDN が正しい `Access-Control-Allow-Origin` ヘッダーを返すことを確認することである。

## React Error Boundary の原理と限界

React の Error Boundary はコンポーネントレベルのエラー捕捉機構である。子コンポーネントツリーがレンダリング、ライフサイクル、コンストラクタでエラーをスローした際、Error Boundary が捕捉してフォールバック UI を表示できる。

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
      <h3>このセクションで問題が発生しました</h3>
      <button onClick={onRetry}>再試行</button>
    </div>
  );
}
```

**Error Boundary の重要な限界**：非同期エラー、イベントコールバック内のエラー、Promise rejection は捕捉しない。以下のエラーは Error Boundary をバイパスする：

```tsx
function BuggyComponent() {
  // ❌ Error Boundary で捕捉されない
  useEffect(() => {
    setTimeout(() => {
      throw new Error('async error');
    }, 1000);
  }, []);

  // ❌ Error Boundary で捕捉されない
  const handleClick = async () => {
    await fetchData();
    throw new Error('event handler error');
  };

  // ✅ Error Boundary で捕捉される（レンダリング中にスロー）
  const data = useSyncExternalStore(subscribe, getSnapshot);
  if (data === null) throw new Error('render error');

  return <button onClick={handleClick}>click</button>;
}
```

非同期エラーについては、イベントハンドラ内部で `try-catch` を使用するか、React 19 の `use()` Hook と Suspense、Error Boundary を組み合わせて非同期状態を処理する必要がある。

**ネスト戦略**：Error Boundary はグローバルに一つだけであるべきではない。ルート別、コンポーネントエリア別にネストすべきである——ナビゲーションバーのクラッシュがページ全体の白画面を引き起こしてはならず、サイドバーのクラッシュがメインコンテンツエリアに影響してはならない。

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

## Vue 3 のエラー捕捉機構

Vue 3 は `onErrorCaptured` と `app.config.errorHandler` の二つの階層のエラーハンドリングを提供する。

```typescript
// Vue 3 のエラー境界コンポーネント
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
      // エラーを報告
      reportError({ type: 'vue_error', error: err, info });
      // false を返してエラーの上位伝播を阻止
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
// グローバルエラーハンドラー
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

// Vue 内部の warn を捕捉（開発モード）
app.config.warnHandler = (msg, instance, trace) => {
  if (import.meta.env.DEV) {
    console.warn(`[Vue warn] ${msg}\n${trace}`);
  }
};

app.mount('#app');
```

Vue の `onErrorCaptured` は React Error Boundary よりカバー範囲が広い——コンポーネント内部のイベントハンドラ関数やライフサイクルフック内のエラーも捕捉できる。ただし `async setup()` 内の rejection は手動で処理する必要がある。

## フォールバック戦略設計：UI フォールバック、機能フォールバック、データフォールバック

エラー捕捉は第一歩に過ぎず、真のレジリエンスはフォールバック戦略から来る。フォールバックは三つの階層に分かれる：

**UI フォールバック**——エラーが発生したコンポーネント領域を簡易版 UI で代替。例えばチャートコンポーネントがクラッシュした場合はテーブルで代替、リッチテキストエディタがクラッシュした場合はプレーンテキスト入力で代替。

**機能フォールバック**——中核機能が利用不可の場合、代替パスを提供。例えばリアルタイムコラボ機能が切断された場合はローカル編集 + 手動同期のヒントにフォールバック。

**データフォールバック**——最新データの取得に失敗した場合、キャッシュデータを使用し「データが古い可能性あり」と注記する。

```typescript
// フォールバック戦略の組み合わせ使用
function useUserData(userId: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userApi.fetch(userId),
    // データフォールバック：失敗時にキャッシュを使用
    retry: 2,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // 機能フォールバック：API が利用不可の場合にローカルデータを使用
  const fallbackData = useLocalUserData(userId);

  const effectiveData = data ?? fallbackData.value;
  const isStale = !!error && !!data;

  return {
    data: effectiveData,
    isLoading,
    isStale, // データが古い可能性をマーク
    error,
  };
}
```

```tsx
// UI フォールバック：チャート → テーブル
function DataVisualization({ data }: { data: ChartData[] }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div>
          <p>チャートのレンダリングに失敗、テーブルビューに切り替えました</p>
          <DataTable data={data} />
          <button onClick={reset}>チャートを再試行</button>
        </div>
      )}
    >
      <ComplexChart data={data} />
    </ErrorBoundary>
  );
}
```

## エラー報告と集約

エラー捕捉後はモニタリングプラットフォームに報告する必要がある。Sentry が最も成熟したアプローチだが、自構築のエラーモニタリングはデータプライバシーとカスタマイズの面で優位性がある。

```typescript
// 報告器の抽象
interface ErrorReporter {
  capture(error: ErrorInfo): void;
  setUser(user: { id: string; email?: string }): void;
  setContext(key: string, value: Record<string, unknown>): void;
}

// Sentry 実装
class SentryReporter implements ErrorReporter {
  constructor(dsn: string) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1, // パフォーマンスサンプリング 10%
      // ノイズエラーのフィルタリング
      beforeSend(event) {
        // 既知の無害なエラーをフィルタリング
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

// 自構築報告実装
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
    // バッチ報告でリクエスト数を削減
    this.flushTimer = window.setTimeout(() => {
      const batch = this.queue.splice(0);
      this.flushTimer = null;

      // sendBeacon でページアンロード時にも送信を保証
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

  setUser(user) { /* ユーザーコンテキストを保存 */ }
  setContext(key, value) { /* 追加コンテキストを保存 */ }
}
```

報告時の**コンテキスト情報**はデバッグにおいて極めて重要である。有用なエラー報告には以下を含むべきである：ユーザー操作パス（何をクリックしたか、どのページから来たか）、アプリケーションバージョン番号、デバイス情報、直近のネットワークリクエスト状態。これらのコンテキストにより、エラーは「どこかがクラッシュした」から「ユーザーが v2.3.1 でホームから購入ボタンをクリックした後、決済 API が 500 を返してクラッシュした」へと変わる。

## 段階的リリースのサーキットブレーカー機構

段階的リリース（カナリアリリース）は本番環境の問題を発見する最後の防衛線である。サーキットブレーカー機構はエラー率が閾値を超えた時に自動的にリリースプロセスを停止する：

```typescript
// 段階的リリースのサーキットブレーカーチェッカー
interface ReleaseHealth {
  errorRate: number;
  crashRate: number;
  sampleSize: number;
}

class ReleaseCircuitBreaker {
  private thresholds = {
    errorRate: 0.05,      // エラー率 > 5% でサーキットブレーカー発動
    crashRate: 0.01,      // クラッシュ率 > 1% でサーキットブレーカー発動
    minSampleSize: 100,   // 統計的有意性のために最低 100 サンプル
  };

  async checkReleaseHealth(
    version: string,
    rolloutPercentage: number,
  ): Promise<{ shouldHalt: boolean; reason?: string }> {
    const health = await this.fetchHealthMetrics(version);

    if (health.sampleSize < this.thresholds.minSampleSize) {
      return { shouldHalt: false }; // サンプル不足、継続観察
    }

    if (health.errorRate > this.thresholds.errorRate) {
      return {
        shouldHalt: true,
        reason: `エラー率 ${(health.errorRate * 100).toFixed(1)}% が閾値 ${this.thresholds.errorRate * 100}% を超過`,
      };
    }

    if (health.crashRate > this.thresholds.crashRate) {
      return {
        shouldHalt: true,
        reason: `クラッシュ率 ${(health.crashRate * 100).toFixed(1)}% が閾値 ${this.thresholds.crashRate * 100}% を超過`,
      };
    }

    return { shouldHalt: false };
  }

  private async fetchHealthMetrics(version: string): Promise<ReleaseHealth> {
    // エラーモニタリングプラットフォームから該当バージョンのエラー指標を照会
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

## Source Map で本番環境のエラースタックを復元

本番環境では通常圧縮された JS をデプロイし、エラースタックには圧縮後の行・列番号しかない。Source Map は圧縮後の位置をソースコードにマッピングできるが、Source Map ファイルを公開ネットワークに露出してはならない（ソースコードの漏洩に等しい）。

標準的な手順はビルド時に Source Map を生成するが CDN にはデプロイせず、エラーモニタリングプラットフォームにアップロードすることである：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: 'hidden', // source map を生成するが JS に参照を追加しない
  },
});

// CI で source map を Sentry にアップロード
// .github/workflows/deploy.yml
// - name: Upload source maps to Sentry
//   run: npx sentry-cli sourcemaps upload --release=$VERSION dist/
//   env:
//     SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
// - name: Delete source maps after upload
//   run: rm -rf dist/**/*.map
```

`hidden` モードは Source Map を生成するが、バンドル成果物に `//# sourceMappingURL=` コメントを追加しない。これによりブラウザは自動的に Source Map をダウンロードしないが、Sentry はアップロードされたファイルでスタックを復元できる。

## レジリエントアーキテクチャの設計原則

1. **障害はつきもの**——設計時にあらゆる環節が障害を起こしうると想定する：API タイムアウト、コンポーネントクラッシュ、リソースロード失敗。各障害ポイントに対応するフォールバック戦略を用意する。
2. **爆発半径の最小化**——細粒度の Error Boundary で障害領域を隔離し、一つのコンポーネントのクラッシュが他の領域に影響しないようにする。ルートレベル、エリアレベル、コンポーネントレベルの三階層ネスト。
3. **フォールバックはエラーより優先**——ユーザーにフォールバック UI を見せる方がエラーダイアログを見せるより体験が良い。キャッシュデータが使えるなら空白にせず、簡易 UI が使えるならエラーを表示しない。
4. **可観測性**——すべてのエラーは報告、集約、分類されるべきである。可観測性のないエラーハンドリングは処理していないのと同じである。
5. **漸進的リカバリ**——「再試行」ボタンでユーザーが能動的に復旧できるようにし、ページ全体のリフレッシュを要求しない。

## まとめ

レジリエントなフロントエンドアプリケーションの構築はシステムエンジニアリングである：エラー分類から出発して完全な捕捉体系を構築し（Error Boundary + グローバルリスナー + リソースエラー）、三階層のフォールバック戦略（UI/機能/データ）を設計し、エラー報告と集約のパイプラインを構築し、Source Map で本番スタックを復元し、段階的リリースのサーキットブレーカーでリリース安全性を守る。中核思想はエラーの発生を必然として受け入れ、隔離、フォールバック、復旧メカニズムを通じてユーザーがエラー環境下でもタスクを完了できるようにすることである。レジリエンスは事後の対応ではなく、アーキテクチャ設計時に内蔵すべき能力である。
