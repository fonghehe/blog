---
title: "Vue 2.6 リリース：v-slot の新構文とその他の改善"
date: 2018-11-08 10:06:29
tags:
  - Vue
readingTime: 3
description: "Vue 2.6 が正式にリリースされました。主な改善はスロット構文の統一、エラーハンドリングの改善、Vue 3 に向けた先見的な変更です。"
wordCount: 602
---

Vue 2.6 が正式にリリースされました。主な改善はスロット構文の統一、エラーハンドリングの改善、Vue 3 に向けた先見的な変更です。

## 最大の変化：v-slot によるスロット構文の統一

以前の Vue 2 にはデフォルトスロット、名前付きスロット、スコープ付きスロットの 3 種類の書き方があり、構文が異なっていました：

```html
{% raw %}
<!-- 以前（Vue 2.5）：3 つの構文 -->

<!-- 名前付きスロット -->
<template slot="header">
  <h1>タイトル</h1>
</template>

<!-- スコープ付きスロット（旧構文）-->
<template slot="item" slot-scope="{ item }">
  <div>{{ item.name }}</div>
</template>

<!-- 新しいスコープ付きスロット構文（2.5 で導入）-->
<template v-slot:item="{ item }">
  <div>{{ item.name }}</div>
</template>
{% endraw %}
```

Vue 2.6 は `v-slot` ですべてのスロットを統一：

```html
{% raw %}
<!-- Vue 2.6：v-slot で統一 -->

<!-- デフォルトスロット -->
<MyComponent>
  <template v-slot:default>
    <p>デフォルトコンテンツ</p>
  </template>
</MyComponent>

<!-- 名前付きスロット -->
<MyLayout>
  <template v-slot:header>
    <h1>タイトル</h1>
  </template>

  <template v-slot:default>
    <p>メインコンテンツ</p>
  </template>

  <template v-slot:footer>
    <p>フッター</p>
  </template>
</MyLayout>

<!-- スコープ付きスロット -->
<MyTable :items="items">
  <template v-slot:item="{ row, index }">
    <tr :key="row.id">
      <td>{{ index + 1 }}</td>
      <td>{{ row.name }}</td>
    </tr>
  </template>
</MyTable>
{% endraw %}
```

**省略構文 `#`：**

```html
<!-- v-slot:header は #header に省略できる -->
<MyLayout>
  <template #header>
    <h1>タイトル</h1>
  </template>

  <template #default="{ item }">
    <ItemCard :item="item" />
  </template>
</MyLayout>
```

## コンポーネント定義：v-slot の設計意図

スロットを提供するコンポーネント（Slot Provider）の書き方は変わらず、消費側の構文のみが統一されました：

```html
<!-- MyTable コンポーネント -->
<template>
  <table>
    <tbody>
      <slot
        v-for="(row, index) in items"
        name="item"
        :row="row"
        :index="index"
      />
    </tbody>
  </table>
</template>
```

## その他の改善

### 動的ディレクティブ引数

```html
<!-- イベント名、スロット名を動的に指定できる -->
<button @[eventName]="handler">ボタン</button>
<template #[slotName]>コンテンツ</template>
```

### エラーハンドリングの改善

`errorCaptured` フックが非同期コンポーネントのエラーをキャプチャできるようになりました：

```javascript
export default {
  errorCaptured(error, component, info) {
    console.log("エラーをキャプチャ:", error);
    console.log("発生場所:", info);
    return false; // エラーの上位への伝播を阻止
  },
};
```

### コンパイルヒントの改善

開発環境のエラーヒントがより詳細になり、どのコンポーネントのどの行で問題が発生したかを正確に指示します。

## 旧構文の廃止計画

`slot` と `slot-scope` の旧構文はまだ使用可能（Vue 2.x 内では削除されない）ですが、非推奨としてマークされており、Vue 3 では削除されます。

`v-slot` への段階的な移行を推奨：

```html
<!-- 非推奨（deprecated） -->
<template slot="header">...</template>
<template slot="item" slot-scope="{ item }">...</template>

<!-- 推奨 -->
<template #header>...</template>
<template #item="{ item }">...</template>
```

## Vue 3 予告

Vue 2.6 のリリースと同時に、Evan You もブログで Vue 3 の計画を述べました：

- パフォーマンス向上（VDOM の最適化、より良い Tree Shaking）
- Composition API（React Hooks に似たロジック再利用）
- より良い TypeScript サポート
- より小さなバンドルサイズ

2019 年にさらに詳細な情報が公開される予定です。

## まとめ

- `v-slot` で Vue のすべてのスロット構文を統一。`#` は省略形
- 動的ディレクティブ引数 `@[eventName]` でより大きな柔軟性
- 旧 `slot` / `slot-scope` は非推奨。Vue 3 で削除される
- Vue 3 の Composition API と TypeScript サポートに期待
