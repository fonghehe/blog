---
title: "Vue スロットの高度な使い方"
date: 2018-04-11 14:48:08
tags:
  - Vue
readingTime: 2
description: "スロットはVueコンポーネント再利用の中で最も強力なメカニズムの1つですが、多くの開発者はデフォルトスロットしか使っていません。実際のプロジェクトでの使い方をまとめます。"
---

スロットはVueコンポーネント再利用の中で最も強力なメカニズムの1つですが、多くの開発者はデフォルトスロットしか使っていません。実際のプロジェクトでの使い方をまとめます。

## デフォルトスロット

```html
<!-- 子コンポーネント Card.vue -->
<template>
  <div class="card">
    <div class="card-body">
      <slot></slot>
      <!-- スロットのプレースホルダー -->
    </div>
  </div>
</template>

<!-- 親コンポーネントでの使用 -->
<Card>
  <h3>タイトル</h3>
  <p>コンテンツ</p>
</Card>
```

## 名前付きスロット

```html
<!-- 子コンポーネント Layout.vue -->
<template>
  <div class="layout">
    <header>
      <slot name="header"></slot>
    </header>
    <main>
      <slot></slot>
      <!-- name なし = デフォルトスロット -->
    </main>
    <footer>
      <slot name="footer"></slot>
    </footer>
  </div>
</template>

<!-- 親コンポーネント -->
<Layout>
  <template v-slot:header>
    <h1>ページタイトル</h1>
  </template>

  <p>メインコンテンツ</p>

  <template v-slot:footer>
    <small>著作権情報</small>
  </template>
</Layout>
```

## スコープ付きスロット（最も有用）

通常のスロットは親コンポーネントのデータしか使えません。スコープ付きスロットは子コンポーネントのデータを親に渡し、親がレンダリング方法を決定できます。

```html
<!-- 子コンポーネント DataTable.vue -->
<template>
  <table>
    <tr v-for="item in data" :key="item.id">
      <!-- itemを親コンポーネントに渡す -->
      <slot :row="item" :index="index"></slot>
    </tr>
  </table>
</template>

<script>
  export default {
    props: ["data"],
  };
</script>
```

```html
<!-- 親コンポーネント：各行のレンダリングを制御 -->
<DataTable :data="users">
  <template v-slot:default="{ row, index }">
    <td>{{ index + 1 }}</td>
    <td>{{ row.name }}</td>
    <td>
      <button @click="edit(row)">編集</button>
    </td>
  </template>
</DataTable>
```

`DataTable`がデータのループを担当し、親コンポーネントが各行の表示ロジックを担当することで、両者が疎結合になります。

## 実際のプロジェクトでの汎用テーブル

```html
<!-- GenericTable.vue -->
<template>
  <div>
    <table class="table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">{{ col.title }}</th>
          <th v-if="$slots.action">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in data" :key="row.id">
          <td v-for="col in columns" :key="col.key">
            <!-- 親コンポーネントが特定列のレンダリングをカスタマイズ可能 -->
            <slot :name="col.key" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
          <td v-if="$slots.action">
            <slot name="action" :row="row"></slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

```html
<!-- 使用例 -->
<GenericTable :columns="columns" :data="users">
  <!-- ステータス列のカスタマイズ -->
  <template v-slot:status="{ value }">
    <span :class="value === 'active' ? 'green' : 'gray'">
      {{ value === 'active' ? '有効' : '無効' }}
    </span>
  </template>

  <!-- 操作列のカスタマイズ -->
  <template v-slot:action="{ row }">
    <button @click="edit(row)">編集</button>
    <button @click="remove(row)">削除</button>
  </template>
</GenericTable>
```

## まとめ

- デフォルトスロット：コンテンツの配置、最もシンプルなユースケース
- 名前付きスロット：複数のスロット位置、レイアウトコンポーネントで頻用
- スコープ付きスロット：子のデータを親のレンダリングロジックに渡す、テーブル・リスト系コンポーネントに最適
- `$slots.xxx`で親が特定スロットを渡しているか確認可能
