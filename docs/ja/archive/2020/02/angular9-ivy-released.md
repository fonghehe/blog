---
title: "Angular 9 正式リリース：Ivyエンジンがもたらすパフォーマンス革命"
date: 2020-02-21 15:24:12
tags:
  - Angular
readingTime: 3
description: "Angular 9 于 2020 年 2 月 6 日正式发布，Ivy 渲染引擎成为默认选项。升级了一批内部项目后，来分享真实的体积变化数据和踩坑经验。"
wordCount: 657
---

Angular 9 は 2020 年 2 月 6 日に正式リリースされ、Ivy レンダリングエンジンがデフォルトになった。いくつかの社内プロジェクトをアップグレードした上で、実際のバンドルサイズの変化データとつまずきやすいポイントを共有する。

## 実際のバンドルサイズ変化データ

公式の数字は場合によっては過度に楽観的だ。以下は社内のいくつかのプロジェクトをアップグレードした後の実測結果である：

| 项目规模          | 升级前 main.js | 升级后 main.js | 减少 |
| ----------------- | -------------- | -------------- | ---- |
| 小型（20 组件）   | 187KB          | 131KB          | 30%  |
| 中型（80 组件）   | 412KB          | 268KB          | 35%  |
| 大型（200+ 组件） | 891KB          | 671KB          | 25%  |

大規模プロジェクトでは削減率が相対的に小さい。これは業務コードの占める割合が高く、フレームワークコードの tree-shaking による恩恵が薄まるためである。

## アップグレード手順

```bash
# 一键升级（推荐）
ng update @angular/core@9 @angular/cli@9

# CLI 会自动：
# 1. 更新 package.json 依赖版本
# 2. 运行 migration schematic（处理 ViewChild static、字符串 loadChildren 等）
# 3. 运行 ngcc 编译第三方库
```

## アップグレード後のよくある問題のトラブルシューティング

**1. ExpressionChangedAfterItHasBeenCheckedError 增多**

Ivy では変更検知がより厳格になった。一般的な原因は、`ngAfterViewInit` 内で親コンポーネントにバインドされた値を書き換えていることである：

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

**2. 第三方组件库样式异常**

Ivy はコンポーネントのスタイルカプセル化の実装を変更したため、`.mat-xxx` などのグローバルクラスに依存する一部のスタイル記法が効かなくなる可能性がある：

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

**3. 动态组件创建 API 变化**

```typescript
// View Engine 方式（仍兼容但不推荐）
const factory = this.resolver.resolveComponentFactory(MyComponent);
this.container.createComponent(factory);

// Ivy 推荐方式（Angular 9+ 支持）
this.container.createComponent(MyComponent);
```

## 新しく追加された providedIn オプション

```typescript
// Angular 9 新增 'any' 和 'platform' 选项
@Injectable({ providedIn: 'any' })
// 'any': 每个懒加载模块获得独立实例，根模块共享一个实例

@Injectable({ providedIn: 'platform' })
// 'platform': 多个 Angular 应用之间共享同一实例（微前端场景）
```

## TestBed 性能提升

Angular 9 の TestBed は Ivy 下では毎回コンポーネントを再コンパイルしなくなったため、テストスイートの実行速度が大きく向上する：

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

## まとめ

Angular 9 は近年でも開発者にとって最も友好的なメジャーアップグレードだ。ほとんどのプロジェクトで苦労なくアップグレードでき、バンドルサイズとパフォーマンスの両面で実質的な改善が得られる。まだ Angular 8 を使っているなら、今がアップグレードの好機である。
