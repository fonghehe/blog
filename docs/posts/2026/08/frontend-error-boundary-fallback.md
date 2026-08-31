---
title: "前端错误边界与降级策略：构建弹性应用"
date: 2026-08-05 19:30:18
tags:
  - 架构
readingTime: 8
description: "前端应用的弹性不只是捕获错误，更是在错误发生后让用户依然能完成任务。本文从错误分类、框架级错误边界、全局捕获、降级策略设计、错误上报到灰度熔断，系统梳理构建弹性前端应用的完整工程方案。"
wordCount: 1519
---

前端应用的稳定性不能只靠"不写 Bug"来保证。随着应用复杂度增长——动态加载、异步交互、第三方依赖、用户环境多样性——运行时错误不可避免。弹性架构的目标不是消灭所有错误，而是让错误发生后用户依然能完成任务，或者至少优雅地降级而非白屏。

## 前端错误的分类

有效的错误处理从正确的分类开始。前端的运行时错误可以分为四类：

**JS 运行时错误**：类型错误、空引用、范围错误等。这类错误是同步抛出的，`try-catch` 和 Error Boundary 都能捕获。

**异步错误**：`setTimeout`、`setInterval`、事件回调中抛出的错误。它们不会冒泡到外层 `try-catch`，需要全局 `window.onerror` 捕获。

**Promise rejection**：Promise 链中未被 `catch` 的 rejection。通过 `unhandledrejection` 事件捕获。

**资源加载错误**：JS/CSS/图片加载失败。`<script onerror>` 或 `PerformanceObserver` 可以捕获，但不会触发 `window.onerror`。

```typescript
// 错误分类的完整捕获体系
function setupGlobalErrorHandlers() {
  // 1. 同步运行时错误
  window.addEventListener('error', (event) => {
    reportError({
      type: 'runtime',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
    // 阻止默认的 console.error
    event.preventDefault();
  });

  // 2. Promise 未捕获 rejection
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      type: 'promise_rejection',
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    });
    event.preventDefault();
  });

  // 3. 资源加载错误（捕获阶段）
  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG')) {
      reportError({
        type: 'resource_error',
        tagName: target.tagName,
        src: target.src || target.href,
      });
    }
  }, true); // 必须在捕获阶段监听

  // 4. 跨域脚本错误（Script error）
  // 需要 <script crossorigin="anonymous"> + 服务端 CORS 头配合
}
```

跨域脚本错误是一个常见的盲区——当加载跨域脚本时，浏览器出于安全考虑只返回 `"Script error."`，没有堆栈信息。解决方式是给 `<script>` 标签加 `crossorigin="anonymous"`，并确保 CDN 返回正确的 `Access-Control-Allow-Origin` 头。

## React Error Boundary 的原理与局限

React 的 Error Boundary 是组件级的错误捕获机制。当子组件树在渲染、生命周期或构造函数中抛出错误时，Error Boundary 可以捕获并显示降级 UI。

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
      <h3>这一块内容出了点问题</h3>
      <button onClick={onRetry}>重试</button>
    </div>
  );
}
```

**Error Boundary 的关键局限**：它不捕获异步错误、事件回调中的错误和 Promise rejection。下面这些错误会绕过 Error Boundary：

```tsx
function BuggyComponent() {
  // ❌ 不会被 Error Boundary 捕获
  useEffect(() => {
    setTimeout(() => {
      throw new Error('async error');
    }, 1000);
  }, []);

  // ❌ 不会被 Error Boundary 捕获
  const handleClick = async () => {
    await fetchData();
    throw new Error('event handler error');
  };

  // ✅ 会被 Error Boundary 捕获（渲染期间抛出）
  const data = useSyncExternalStore(subscribe, getSnapshot);
  if (data === null) throw new Error('render error');

  return <button onClick={handleClick}>click</button>;
}
```

对于异步错误，需要在事件处理函数内部用 `try-catch`，或者用 React 19 的 `use()` Hook 配合 Suspense 和 Error Boundary 处理异步状态。

**嵌套策略**：Error Boundary 不应该只有一个全局的。应该按路由、按组件区块嵌套——导航栏崩溃不应该导致整个页面白屏，侧边栏崩溃不应该影响主内容区。

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

## Vue 3 的错误捕获机制

Vue 3 提供了 `onErrorCaptured` 和 `app.config.errorHandler` 两个层级的错误处理。

```typescript
// Vue 3 的错误边界组件
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
      // 上报错误
      reportError({ type: 'vue_error', error: err, info });
      // 返回 false 阻止错误继续向上传播
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
// 全局错误处理器
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

// 捕获 Vue 内部的 warn（开发模式）
app.config.warnHandler = (msg, instance, trace) => {
  if (import.meta.env.DEV) {
    console.warn(`[Vue warn] ${msg}\n${trace}`);
  }
};

app.mount('#app');
```

Vue 的 `onErrorCaptured` 比 React Error Boundary 的覆盖范围更广——它能捕获组件内部事件处理函数和生命周期钩子中的错误。但 `async setup()` 中的 rejection 仍需要手动处理。

## 降级策略设计：UI 降级、功能降级、数据降级

错误捕获只是第一步，真正的弹性来自降级策略。降级分为三个层级：

**UI 降级**——出错的组件区域用简化版 UI 替代。例如图表组件崩溃时用表格替代，富文本编辑器崩溃时用纯文本输入框替代。

**功能降级**——核心功能不可用时，提供替代路径。例如实时协作功能断连时降级为本地编辑 + 手动同步提示。

**数据降级**——新鲜数据获取失败时，使用缓存数据并标注"数据可能过期"。

```typescript
// 降级策略的组合使用
function useUserData(userId: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userApi.fetch(userId),
    // 数据降级：失败时使用缓存
    retry: 2,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // 功能降级：API 不可用时使用本地数据
  const fallbackData = useLocalUserData(userId);

  const effectiveData = data ?? fallbackData.value;
  const isStale = !!error && !!data;

  return {
    data: effectiveData,
    isLoading,
    isStale, // 标记数据可能过期
    error,
  };
}
```

```tsx
// UI 降级：图表 → 表格
function DataVisualization({ data }: { data: ChartData[] }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div>
          <p>图表渲染失败，已切换为表格视图</p>
          <DataTable data={data} />
          <button onClick={reset}>重试图表</button>
        </div>
      )}
    >
      <ComplexChart data={data} />
    </ErrorBoundary>
  );
}
```

## 错误上报与聚合

错误捕获后需要上报到监控平台。Sentry 是最成熟的方案，但自建错误监控在数据隐私和定制化方面有优势。

```typescript
// 上报器抽象
interface ErrorReporter {
  capture(error: ErrorInfo): void;
  setUser(user: { id: string; email?: string }): void;
  setContext(key: string, value: Record<string, unknown>): void;
}

// Sentry 实现
class SentryReporter implements ErrorReporter {
  constructor(dsn: string) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1, // 性能采样 10%
      // 过滤噪音错误
      beforeSend(event) {
        // 过滤已知的无害错误
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

// 自建上报实现
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
    // 批量上报，减少请求次数
    this.flushTimer = window.setTimeout(() => {
      const batch = this.queue.splice(0);
      this.flushTimer = null;

      // 使用 sendBeacon 确保页面卸载时也能发出
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

  setUser(user) { /* 存储用户上下文 */ }
  setContext(key, value) { /* 存储额外上下文 */ }
}
```

上报时的**上下文信息**对排错至关重要。一个有用的错误上报应该包含：用户操作路径（点击了什么、从哪个页面来）、应用版本号、设备信息、最近的网络请求状态。这些上下文让错误从"某个地方崩了"变成"用户在 v2.3.1 版本、从首页点击购买按钮后、支付接口返回 500 导致崩溃"。

## 灰度发布中的错误熔断机制

灰度发布是发现生产环境问题的最后一道防线。熔断机制在错误率超过阈值时自动停止发布流程：

```typescript
// 灰度发布熔断检查器
interface ReleaseHealth {
  errorRate: number;
  crashRate: number;
  sampleSize: number;
}

class ReleaseCircuitBreaker {
  private thresholds = {
    errorRate: 0.05,      // 错误率 > 5% 触发熔断
    crashRate: 0.01,      // 崩溃率 > 1% 触发熔断
    minSampleSize: 100,   // 至少 100 个样本才有统计意义
  };

  async checkReleaseHealth(
    version: string,
    rolloutPercentage: number,
  ): Promise<{ shouldHalt: boolean; reason?: string }> {
    const health = await this.fetchHealthMetrics(version);

    if (health.sampleSize < this.thresholds.minSampleSize) {
      return { shouldHalt: false }; // 样本不足，继续观察
    }

    if (health.errorRate > this.thresholds.errorRate) {
      return {
        shouldHalt: true,
        reason: `错误率 ${(health.errorRate * 100).toFixed(1)}% 超过阈值 ${this.thresholds.errorRate * 100}%`,
      };
    }

    if (health.crashRate > this.thresholds.crashRate) {
      return {
        shouldHalt: true,
        reason: `崩溃率 ${(health.crashRate * 100).toFixed(1)}% 超过阈值 ${this.thresholds.crashRate * 100}%`,
      };
    }

    return { shouldHalt: false };
  }

  private async fetchHealthMetrics(version: string): Promise<ReleaseHealth> {
    // 从错误监控平台查询该版本的错误指标
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

## Source Map 还原生产环境错误堆栈

生产环境部署的通常是压缩后的 JS，错误堆栈里只剩压缩后的行列号。Source Map 能把压缩后的位置映射回源码，但 Source Map 文件不能暴露给公网（等于泄露源码）。

标准做法是构建时生成 Source Map 但不部署到 CDN，而是上传到错误监控平台：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: 'hidden', // 生成 source map 但不在 JS 中引用
  },
});

// CI 中上传 source map 到 Sentry
// .github/workflows/deploy.yml
// - name: Upload source maps to Sentry
//   run: npx sentry-cli sourcemaps upload --release=$VERSION dist/
//   env:
//     SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
// - name: Delete source maps after upload
//   run: rm -rf dist/**/*.map
```

`hidden` 模式生成 Source Map 但不在打包产物中添加 `//# sourceMappingURL=` 注释。这样浏览器不会自动下载 Source Map，但 Sentry 可以用上传的文件做堆栈还原。

## 弹性架构的设计原则

1. **失败是常态**——设计时假设任何环节都可能失败：API 超时、组件崩溃、资源加载失败。每个失败点都应有对应的降级方案。
2. **爆炸半径最小化**——用细粒度的 Error Boundary 隔离故障区域，一个组件崩溃不影响其他区域。路由级、区块级、组件级三层嵌套。
3. **降级优于报错**——用户看到降级 UI 比看到错误弹窗体验更好。能用缓存数据就不用空白，能用简化 UI 就不显示错误。
4. **可观测性**——每个错误都应该被上报、聚合、归类。没有可观测性的错误处理等于没有处理。
5. **渐进恢复**——提供"重试"按钮让用户主动恢复，而不是要求刷新整个页面。

## 小结

构建弹性前端应用是一个系统工程：从错误分类出发建立完整的捕获体系（Error Boundary + 全局监听 + 资源错误），设计三级降级策略（UI/功能/数据），搭建错误上报与聚合管道，配置 Source Map 还原生产堆栈，用灰度熔断守卫发布安全。核心思想是接受错误必然发生，但通过隔离、降级和恢复机制让用户在错误环境下依然能完成任务。弹性不是事后补救，而是架构设计时就需要内建的能力。
