---
title: "Angular 11 実践：Webpack 5 統合とストリクトモードの全面有効化"
date: 2021-01-02 09:43:58
tags:
  - Angular
  - Webpack
  - TypeScript
  - CSS

readingTime: 3
description: "Angular 11 于 2020 年 11 月发布，进入新的一年，这里系统总结升级后最值得深入使用的两个特性：Webpack 5 实验性支持和严格模式。前者大幅提升构建速度，后者帮你从根源消灭一类 bug。"
wordCount: 763
---

Angular 11 は 2020 年 11 月にリリースされました。年明けにあたり、アップグレード後に最も深く使いこなすべき 2 つの特性を体系的にまとめます：Webpack 5 の実験的サポートとストリクトモードです。前者はビルド速度を大きく向上させ、後者はある種のバグを根本から排除する手助けをします。

## Webpack 5 実験的サポートの有効化

Angular 11 では Webpack 5 が実験的機能として位置づけられており、正式に安定するのは Angular 12 まで待つ必要があります。しかし今すぐその永続キャッシュを試すことができます：

```bash
# 1. 使用 yarn（Webpack 5 需要 yarn resolutions）
yarn set version berry  # 可选

# 2. package.json 添加 resolutions
```

```json
{
  "resolutions": {
    "webpack": "^5.0.0"
  },
  "scripts": {
    "postinstall": "ngcc"
  }
}
```

```bash
yarn install
```

```json
// angular.json - 开启实验性 Webpack 5
{
  "cli": {
    "packageManager": "yarn"
  }
}
```

**構築速度の比較**（中型プロジェクト、約 150 のコンポーネント）：

|           | 首次构建 | 增量构建（持久化缓存后） |
| --------- | -------- | ------------------------ |
| Webpack 4 | 45s      | 18s                      |
| Webpack 5 | 38s      | **4s**                   |

永続キャッシュによる 4 秒のインクリメンタルビルドは最大のメリットです——日常の開発では待ち時間をほとんど感じなくなります。

## ストリクトモード：一度で完全移行

新規プロジェクトでは `ng new --strict` によってデフォルトで有効になります。既存のプロジェクトでは手動で有効にする必要があります：

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

### strictTemplates 捕获的典型错误

**1. 可选链问题**

```html
<!-- ❌ user 可能是 null，严格模式会报错 -->
<p>{{ user.name }}</p>

<!-- ✅ 方式一：使用 *ngIf -->
<p *ngIf="user">{{ user.name }}</p>

<!-- ✅ 方式二：可选链 -->
<p>{{ user?.name }}</p>
```

**2. EventEmitter 类型推断**

```typescript
// ❌ 没有类型参数，严格模式下 $event 为 any
@Output() selected = new EventEmitter();

// ✅ 明确类型
@Output() selected = new EventEmitter<User>();
```

**3. ngFor 的 trackBy 类型**

```typescript
// ❌ 严格模式下，trackBy 函数参数类型必须匹配
// trackBy(index: number, item) - item 是 any

// ✅ 明确类型
trackByUser(index: number, user: User): number {
  return user.id;
}
```

## フォントインライン化

Angular 11 はデフォルトでビルド時に Google Fonts の CSS をインライン化し、ネットワーク往復を 1 回減らします：

```json
// angular.json - 默认已开启，如需关闭：
{
  "build": {
    "options": {
      "optimization": {
        "fonts": false
      }
    }
  }
}
```

LCP（Largest Contentful Paint：最大コンテンツの描画）の指標に好影響を与えるため、オンのままにしておくことをお勧めします。

## strictInputAccessModifiers

これは Angular 11 で新たに追加されたコンパイラオプションで、テンプレートから private/protected なプロパティへのアクセスを防ぐものです：

```typescript
@Component({
  template: `{{ privateData }}`, // ❌ 严格模式报错
})
export class MyComponent {
  private privateData = "secret";
  protected protectedData = "also restricted";
}
```

このルールにより、テンプレートは public API だけを使うことが強制され、コンポーネントのカプセル化に役立ちます。

## アップグレード手順

```bash
ng update @angular/core@11 @angular/cli@11
ng update @angular/material@11  # 如果使用 Material

# 查看升级指南
ng update --list
```

## まとめ

Angular 11 へのアップグレードは、既存のプロジェクトにとって低リスクで高いリターンが得られます。ストリクトモードは年始に一度、全面的に有効化する計画を立てる価値があります——TypeScript 4.1 のテンプレートリテラル型と組み合わせることで、2021 年の Angular プロジェクトの型安全性は一段階上がるでしょう。
