---
title: "Angular 9 Official Release: The Performance Revolution of the Ivy Engine"
date: 2020-02-21 15:24:12
tags:
  - Angular
readingTime: 2
description: "Angular 9 was officially released on February 6, 2020, with the Ivy rendering engine now enabled by default. After upgrading several of our internal projects, I'd like to share the real bundle-size changes we measured and the pitfalls we ran into."
wordCount: 249
---

Angular 9 was officially released on February 6, 2020, with the Ivy rendering engine now enabled by default. After upgrading several of our internal projects, I'd like to share the real bundle-size changes we measured and the pitfalls we ran into.

## Actual Bundle Size Change Data

Official numbers can be a bit optimistic at times, so here are the real measurements from a few of our internal projects after upgrading:

| Project scale          | main.js before | main.js after | Reduction |
| ----------------- | -------------- | -------------- | ---- |
| Small (20 components)   | 187KB          | 131KB          | 30%  |
| Medium (80 components)   | 412KB          | 268KB          | 35%  |
| Large (200+ components) | 891KB          | 671KB          | 25%  |

Large projects see a smaller reduction because business code makes up a larger share, which dilutes the tree-shaking gains from the framework code.

## Upgrade Steps

```bash
# 一键升级（推荐）
ng update @angular/core@9 @angular/cli@9

# CLI 会自动：
# 1. 更新 package.json 依赖版本
# 2. 运行 migration schematic（处理 ViewChild static、字符串 loadChildren 等）
# 3. 运行 ngcc 编译第三方库
```

## Troubleshooting Common Post-Upgrade Issues

**1. More frequent `ExpressionChangedAfterItHasBeenCheckedError` errors**

Ivy's change detection is stricter. A common cause is mutating a value bound by the parent component inside `ngAfterViewInit`:

```typescript
// ❌ 触发错误
ngAfterViewInit() {
  this.title = 'loaded'; // 父组件模板绑定了 title
}

// ✅ 用 setTimeout 或 ChangeDetectorRef 解决
constructor(private cdr: ChangeDetectorRef) {}
ngAfterViewInit() {
  setTimeout(() => {
    this.title = 'loaded';
    this.cdr.detectChanges();
  });
}
```

**2. Broken styles in third-party component libraries**

Ivy changed how component style encapsulation is implemented, so some style rules that relied on global classes like `.mat-xxx` may stop working:

```scss
// ❌ 在宿主组件样式里穿透子组件（Ivy 下可能不生效）
:host ::ng-deep .mat-input-element {
  color: red;
}

// ✅ 在全局样式（styles.scss）里覆盖
.my-custom-input .mat-input-element {
  color: red;
}
```

**3. Changes to the dynamic component creation API**

```typescript
// View Engine 方式（仍兼容但不推荐）
const factory = this.resolver.resolveComponentFactory(MyComponent);
this.container.createComponent(factory);

// Ivy 推荐方式（Angular 9+ 支持）
this.container.createComponent(MyComponent);
```

## New `providedIn` Options

```typescript
// Angular 9 新增 'any' 和 'platform' 选项
@Injectable({ providedIn: 'any' })
// 'any': 每个懒加载模块获得独立实例，根模块共享一个实例

@Injectable({ providedIn: 'platform' })
// 'platform': 多个 Angular 应用之间共享同一实例（微前端场景）
```

## Improved TestBed Performance

Under Ivy, Angular 9's TestBed no longer recompiles components on every run, so test suites run noticeably faster:

```typescript
// 不变的测试代码，但执行速度快了 2-3x
describe("UserComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserComponent],
    }).compileComponents();
  });
  // ...
});
```

## Summary

Angular 9 is the most developer-friendly major upgrade in recent years — most projects can upgrade painlessly, with real improvements to both bundle size and performance. If you're still on Angular 8, now is a great time to upgrade.
