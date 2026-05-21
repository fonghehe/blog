---
title: "Angular 21.1 正式发布：httpResource 稳定化与 Signal 生态全面落地"
date: 2026-01-03 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 21 在 2025 年 11 月完成了 Signal 化转型的里程碑，而 21.1 作为第一个小版本，在 2026 年 1 月带来了大量生态稳定化工作。其中最引人注目的是 `httpResource` 正式升级为稳定 API，以及 `linkedSignal` 在复杂状态管理中的深度集成。"
wordCount: 483
---

Angular 21 在 2025 年 11 月完成了 Signal 化转型的里程碑，而 21.1 作为第一个小版本，在 2026 年 1 月带来了大量生态稳定化工作。其中最引人注目的是 `httpResource` 正式升级为稳定 API，以及 `linkedSignal` 在复杂状态管理中的深度集成。

## httpResource 全面稳定

`httpResource` 在 Angular 20 中以开发者预览身份亮相，经过两个大版本的打磨，21.1 将其标记为稳定。它将 HTTP 请求与 Signal 反应式系统无缝融合：

```typescript
import { httpResource } from "@angular/common/http";
import { computed, signal } from "@angular/core";

@Component({
  selector: "app-user-profile",
  template: `
    @if (userResource.isLoading()) {
      <app-skeleton />
    } @else if (userResource.error()) {
      <p class="error">{{ userResource.error()?.message }}</p>
    } @else {
      <app-user-card [user]="userResource.value()!" />
    }
  `,
})
export class UserProfileComponent {
  userId = signal<number>(1);

  userResource = httpResource<User>(() => ({
    url: `/api/users/${this.userId()}`,
    method: "GET",
  }));

  // 依赖 userId Signal，自动重新请求
  displayName = computed(() => userResource.value()?.name ?? "加载中...");
}
```

21.1 新增了请求去重（request deduplication）与缓存策略配置：

```typescript
userResource = httpResource<User>(() => `/api/users/${this.userId()}`, {
  // 相同 URL 的并发请求自动合并
  deduplicate: true,
  // 缓存 30 秒
  cache: { ttl: 30_000 },
  // 请求失败时自动重试 2 次
  retry: { count: 2, delay: 1000 },
});
```

## linkedSignal 的复杂场景应用

`linkedSignal` 解决了一类经典问题：当源 Signal 改变时，派生 Signal 需要重置但又保留用户的本地修改。

```typescript
@Component({ template: `...` })
export class PaginatedListComponent {
  pageSize = signal(10);
  currentPage = signal(1);

  // 当 pageSize 变化时，自动重置到第一页
  // 但用户手动翻页时保持 currentPage 不受 pageSize 影响
  page = linkedSignal({
    source: this.pageSize,
    computation: () => 1, // pageSize 变化时重置为 1
  });

  items = httpResource(() => ({
    url: "/api/items",
    params: { page: this.page(), size: this.pageSize() },
  }));

  goToPage(n: number) {
    this.page.set(n); // 用户操作，不触发重置
  }

  changePageSize(size: number) {
    this.pageSize.set(size); // 触发 page 重置为 1
  }
}
```

## Signal DevTools 增强

Angular DevTools 在 21.1 中针对 Signal 调试做了重大升级：

- **Signal 依赖图可视化**：在 DevTools 面板中可以直观看到每个 Signal 的依赖关系
- **时间旅行调试**：记录 Signal 状态变化历史，支持回退到任意快照
- **性能热点检测**：标记出频繁触发的 computed 和 effect，帮助识别过度计算

```typescript
// 开发模式下，这段代码会在 DevTools 中显示完整调用栈
const total = computed(
  () => {
    // DevTools 会追踪此 computed 的所有依赖
    return items().reduce((sum, item) => sum + item.price, 0);
  },
  { debugName: "cartTotal" },
); // 21.1 新增 debugName 选项
```

## 迁移指南：从 21.0 升级到 21.1

```bash
ng update @angular/core@21.1 @angular/cli@21.1
```

21.1 完全向后兼容，主要变化：

1. `httpClient.get()` 等传统方法仍然可用，但 IDE 会显示"建议迁移到 httpResource"提示
2. `resource()` API 的 `loader` 函数现在支持 `AbortSignal`，取消请求更加优雅
3. `effect()` 的调度策略新增 `microtask` 选项，适用于需要同步感知的场景

## 总结

Angular 21.1 稳定化了 `httpResource` 与 Signal 工具链，让 2025 年许多"开发者预览"功能真正进入生产可用状态。配合增强的 DevTools，2026 年的 Angular 开发体验比以往任何时候都更加流畅。下一个版本 21.2 将聚焦于 Signal Forms 的生产实践改进，值得期待。
