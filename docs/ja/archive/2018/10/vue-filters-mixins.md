---
title: "Vue グローバルフィルターとミックスイン"
date: 2018-10-18 15:24:55
tags:
  - Vue
readingTime: 2
description: "プロジェクトにはコンポーネントをまたいで使う機能が多くあります：日付フォーマット、金額表示、権限チェック……Vue のグローバルフィルターとミックスインを使えば、これらのロジックを集中管理できます。"
wordCount: 432
---

プロジェクトにはコンポーネントをまたいで使う機能が多くあります：日付フォーマット、金額表示、権限チェック……Vue のグローバルフィルターとミックスインを使えば、これらのロジックを集中管理できます。

## グローバルフィルター

```javascript
// main.js
import Vue from "vue";
import dayjs from "dayjs";

// 日付フォーマット
Vue.filter("date", (value, format = "YYYY-MM-DD") => {
  if (!value) return "-";
  return dayjs(value).format(format);
});

// 金額フォーマット（銭→元、桁区切り）
Vue.filter("money", (value) => {
  if (value === null || value === undefined) return "-";
  return (value / 100).toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
  });
});

// ファイルサイズ
Vue.filter("fileSize", (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
});

// 列挙値の翻訳
const STATUS_MAP = { 1: "正常", 2: "無効", 3: "審査待ち" };
Vue.filter("status", (value) => STATUS_MAP[value] || "不明");
```

```html
{% raw %}
<!-- テンプレートでの使用：パイプ | を使う -->
<td>{{ order.createdAt | date }}</td>
<td>{{ order.createdAt | date('YYYY/MM/DD HH:mm') }}</td>
<td>{{ order.amount | money }}</td>
<td>{{ file.size | fileSize }}</td>
<td>{{ user.status | status }}</td>
{% endraw %}
```

## ローカルフィルター（コンポーネント内）

```javascript
export default {
  filters: {
    // このコンポーネント内でのみ使用
    truncate(value, length = 20) {
      if (!value) return "";
      return value.length > length ? value.slice(0, length) + "..." : value;
    },
  },
};
```

## グローバルミックスイン

**グローバルミックスインは慎重に使用してください** — すべてのコンポーネントに影響し、予期しない副作用を引き起こしやすいです：

```javascript
// main.js
Vue.mixin({
  // すべてのコンポーネントがこのメソッドを持つ
  methods: {
    // グローバルな権限チェックメソッド
    $hasPermission(permission) {
      const userPermissions = this.$store.getters.permissions;
      return userPermissions.includes(permission);
    },
  },
});
```

```html
<!-- どのコンポーネントでも使用可能 -->
<el-button v-if="$hasPermission('user:delete')" @click="deleteUser(row)">
  削除
</el-button>
```

## ローカルミックスイン（推奨）

```javascript
// mixins/tableOperations.js
export const tableOperations = {
  data() {
    return {
      loading: false,
      list: [],
      total: 0,
      params: { page: 1, pageSize: 20 },
    };
  },
  methods: {
    async loadList() {
      this.loading = true;
      try {
        const { list, total } = await this.fetchList(this.params);
        this.list = list;
        this.total = total;
      } finally {
        this.loading = false;
      }
    },
    handlePageChange(page) {
      this.params.page = page;
      this.loadList();
    },
  },
  created() {
    this.loadList();
  },
};
```

```javascript
// コンポーネントでミックスインを使用
import { tableOperations } from "@/mixins/tableOperations";

export default {
  mixins: [tableOperations],
  methods: {
    // ミックスインから呼び出される fetchList を実装
    fetchList(params) {
      return this.$api.getUserList(params);
    },
  },
};
```

## ミックスインの問題点

Vue 2 のミックスインの主な問題は**出所の不透明さ**です：コンポーネントで `this.loading` を使っても、どこから来たのかわかりません。

Vue 3 の Composition API（`setup`）がこの問題を完全に解決し、ミックスインはもはや推奨されていません。

## まとめ

- グローバルフィルター：日付、金額などのフォーマット — テンプレートで `|` パイプを使って呼び出す
- グローバルミックスイン：慎重に使用。権限チェックなど真にグローバルな機能に適切
- ローカルミックスイン：コンポーネントロジックを再利用するが出所が不透明 — Vue 3 では Composable で置き換える
