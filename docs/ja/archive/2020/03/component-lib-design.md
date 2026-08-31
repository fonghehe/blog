---
title: "エンタープライズコンポーネントライブラリの設計思想"
date: 2020-03-18 16:39:59
tags:
  - エンジニアリング
readingTime: 2
description: "团队在管理后台项目中积累了几十个业务组件，但散落在各个项目里，复用靠复制粘贴。决定抽离出一个内部组件库，记录一下设计思路。"
wordCount: 349
---

管理画面のプロジェクトを進める中で数十個の業務コンポーネントが溜まったが、各プロジェクトに散在していて、再利用はコピペに頼っていた。そこで社内用のコンポーネントライブラリとして切り出すことにし、その設計の考え方をまとめておく。

## コンポーネントの階層化

```
コンポーネントライブラリ
├── 基礎層（primitives）
│   ├── Button・Input・Select
│   ├── ビジネスロジックに依存しない
│   └── どのプロジェクトからでも利用可能
├── 業務層（business）
│   ├── UserSelect（ユーザー選択）
│   ├── DepartmentTree（部署ツリー）
│   ├── PermissionGuard（権限ガード）
│   └── 基礎層 + 業務 API に依存
└── 複合層（composite）
    ├── SearchForm（検索フォーム）
    ├── DataTable（データテーブル + ページネーション + 絞り込み）
    └── 業務層と基礎層を組み合わせて構成
```

## コンポーネントAPI設計の原則

```vue
{% raw %}
<!-- 原則 1：props 駆動、slot で拡張 -->
<template>
  <div class="data-table">
    <!-- 名前付きスロットでデフォルトの描画を上書き -->
    <table>
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">
            <!-- ヘッダーのカスタマイズに対応 -->
            <slot :name="`header-${col.key}`" :column="col">
              {{ col.title }}
            </slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in displayData" :key="row[rowKey]">
          <td v-for="col in columns" :key="col.key">
            <!-- セルのカスタマイズに対応 -->
            <slot :name="`cell-${col.key}`" :row="row" :column="col">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- スコープ付きスロット：空状態のカスタマイズ -->
    <slot name="empty" v-if="!displayData.length">
      <div class="empty">データがありません</div>
    </slot>
  </div>
</template>

<script>
export default {
  name: 'DataTable',
  props: {
    // 必須：列の設定
    columns: {
      type: Array,
      required: true,
      validator: (cols) => cols.every(c => c.key && c.title),
    },
    // 必須：データ
    data: { type: Array, default: () => [] },
    // 行を一意に識別するキー
    rowKey: { type: String, default: 'id' },
    // ページネーション
    pagination: {
      type: [Object, Boolean],
      default: () => ({ page: 1, pageSize: 20, total: 0 }),
    },
    // ローディング状態
    loading: { type: Boolean, default: false },
  },
  computed: {
    displayData() {
      if (!this.pagination) return this.data;
      const { page, pageSize } = this.pagination;
      return this.data.slice((page - 1) * pageSize, page * pageSize);
    },
  },
};
</script>
{% endraw %}
```

## 原則 2：イベントの統一

```javascript
// イベント名の統一ルール：on + 動詞 + 名詞
// 良い命名
this.$emit('change', value);
this.$emit('select', row);
this.$emit('page-change', { page, pageSize });
this.$emit('search', queryParams);

// 悪い命名
this.$emit('input', value);        // v-model 専用
this.$emit('update', value);       // 曖昧すぎる
this.$emit('onPageChange');        // on プレフィックスは冗長
```

## 原則 3：スタイルの分離 + テーマ化

```scss
// CSS 変数でテーマを実現
:root {
  --dt-primary-color: #409eff;
  --dt-border-color: #e4e7ed;
  --dt-bg-header: #f5f7fa;
  --dt-font-size: 14px;
  --dt-row-height: 48px;
}

.data-table {
  width: 100%;
  border: 1px solid var(--dt-border-color);
  border-radius: 4px;
  font-size: var(--dt-font-size);

  th {
    background: var(--dt-bg-header);
    height: var(--dt-row-height);
    padding: 0 16px;
    font-weight: 500;
  }

  td {
    height: var(--dt-row-height);
    padding: 0 16px;
    border-bottom: 1px solid var(--dt-border-color);
  }
}

// ダークテーマは変数を上書きするだけ
[data-theme='dark'] {
  --dt-border-color: #4c4d4f;
  --dt-bg-header: #2b2b2b;
}
```

## 公開と利用方法

```json
// package.json
{
  "name": "@company/ui",
  "version": "0.1.0",
  "main": "lib/index.js",
  "module": "es/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib", "es", "types"],
  "sideEffects": ["*.css", "*.scss"]
}
```

```javascript
// 必要なものだけを import
import { DataTable, SearchForm } from '@company/ui';

// 一式まとめて import
import CompanyUI from '@company/ui';
Vue.use(CompanyUI);
```

## ドキュメントとサンプル

```markdown
各コンポーネントには以下が必要：
1. Props 表（名前・型・デフォルト値・説明）
2. Events 表
3. Slots 表
4. 最低 3 つのサンプル（基本・応用・エッジケース）
5. 設計メモ（使うべき場面・使わない方がよい場面）

ドキュメントサイトは VuePress か Storybook で構築するのがおすすめ。
```

## まとめ

- コンポーネントは基礎・業務・複合の 3 層に分かれ、責務が明確。
- API は props 駆動 + slot 拡張とし、利用者の理解コストを下げる。
- CSS 変数でテーマ化し、プリプロセッサなしでもスタイルを上書きできる。
- 各コンポーネントに丁寧なドキュメントとサンプルを用意し、チームの学習コストを下げる。
- 社内ライブラリは「なんでも揃っていること」を目指さず、チームの実際の悩みを解消できれば十分。
