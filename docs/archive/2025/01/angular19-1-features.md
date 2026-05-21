---
title: "Angular 19.1：增量水合稳定化与 linkedSignal 进展"
date: 2025-01-02 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 19.1 于 2025 年 1 月发布，是 Angular 19 系列的第一个小版本。重点是将 Angular 19 中引入的实验性特性向稳定化推进：增量水合（Incremental Hydration）进入开发者预览稳定期，`linkedSignal()` 的 API 经过反馈修订，Zoneless "
wordCount: 336
---

Angular 19.1 于 2025 年 1 月发布，是 Angular 19 系列的第一个小版本。重点是将 Angular 19 中引入的实验性特性向稳定化推进：增量水合（Incremental Hydration）进入开发者预览稳定期，`linkedSignal()` 的 API 经过反馈修订，Zoneless 模式也在持续打磨中。

## 增量水合：从实验到开发者预览

Angular 19.0 的增量水合标记为实验性。Angular 19.1 基于社区反馈做了改进，并将其提升为开发者预览（Developer Preview）：

```typescript
// 19.1 起推荐方式（与 19.0 API 相同，但稳定性更好）
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(withIncrementalHydration())],
};
```

19.1 修复的主要问题：

```html
<!-- 19.0 的已知问题：@defer 块内嵌套时水合顺序不稳定 -->
<!-- 19.1 修复：嵌套 @defer 水合顺序正确化 -->
@defer (hydrate on viewport) {
<outer-component>
  @defer (hydrate on interaction) {
  <inner-component />
  <!-- 19.0 有时会先于 outer 水合，19.1 修复 -->
  }
</outer-component>
}
```

## linkedSignal：API 精简与文档完善

经过社区试用，Angular 团队对 `linkedSignal()` 做了细微调整：

```typescript
// 19.0 的两种写法都保留（短格式和对象格式）
import { linkedSignal } from "@angular/core";

// 短格式（最常用）：源变化时重新计算
const selectedItem = linkedSignal(() => items()[0] ?? null);

// 对象格式（需要访问前值）：
const currentPage = linkedSignal<number>({
  source: () => ({ query: searchQuery(), pageSize: pageSize() }),
  computation: (source, previous) => {
    // 查询变化时重置到第 1 页，否则保留当前页
    if (!previous || previous.source.query !== source.query) return 1;
    return Math.min(previous.value, Math.ceil(totalItems() / source.pageSize));
  },
});

// 19.1 新增：linkedSignal 现在可以接受初始值参数（而不依赖 source 函数）
const count = linkedSignal({
  source: externalCount, // Signal<number>
  computation: (val) => val * 2,
});
```

## Signal Effect 清理机制改进

Angular 19.1 改进了 `effect()` 的资源清理 API：

```typescript
import { effect, inject, DestroyRef } from '@angular/core';

@Component({ standalone: true, ... })
export class DataStreamComponent {
  private ws: WebSocket | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect((onCleanup) => {
      const url = this.wsUrl();
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onmessage = (evt) => this.messages.update(m => [...m, evt.data]);

      // 19.1 改进：onCleanup 类型更准确，支持 async 清理函数
      onCleanup(() => {
        ws.close();
        this.ws = null;
      });
    });
  }

  messages = signal<string[]>([]);
  wsUrl = input.required<string>();
}
```

## 模板类型检查增强

Angular 19.1 增强了对 Signal 表达式的类型检查：

```typescript
@Component({
  standalone: true,
  template: `
    <!-- 19.1 之前：编译器不能精确检查 Signal 嵌套访问的类型 -->
    <!-- 19.1 之后：精确推断 user()?.profile?.avatar 的类型 -->
    <img [src]="user()?.profile?.avatar ?? defaultAvatar" />

    <!-- @for track 表达式的类型也得到改善 -->
    @for (item of items(); track item.id) {
      {{ item.name }}
    }
  `,
})
export class UserCardComponent {
  user = input<User | null>(null);
  items = input.required<{ id: string; name: string }[]>();
  defaultAvatar = "/assets/default-avatar.png";
}
```

## 升级到 19.1

```bash
ng update @angular/core@19.1 @angular/cli@19.1

# 查看变更日志
npx ng-update --list
```

Angular 19.x 系列按每月节奏发布小版本（19.1 → 19.2 → 19.3），每个版本都在为 Angular 20（预计 2025 年 5 月）积累稳定性。

## 总结

Angular 19.1 是一个"巩固"版本——增量水合升级为开发者预览意味着可以开始在预生产环境验证，`linkedSignal` 的 API 也更加完善。如果你在 Angular 19.0 时因为增量水合的实验性标签而保持观望，19.1 是开始评估的好时机。
