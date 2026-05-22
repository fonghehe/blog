---
title: "企業級組件庫設計思路：落地路徑與實戰建議"
date: 2020-03-18 16:39:59
tags:
  - 工程化
readingTime: 2
description: "團隊在管理後臺項目中積累了幾十個業務組件，但散落在各個項目裏，複用靠複製粘貼。決定抽離出一個內部組件庫，記錄一下設計思路。"
wordCount: 209
---

團隊在管理後臺項目中積累了幾十個業務組件，但散落在各個項目裏，複用靠複製粘貼。決定抽離出一個內部組件庫，記錄一下設計思路。

## 組件分層

```
組件庫
├── 基礎層（primitives）
│   ├── Button、Input、Select
│   ├── 不依賴任何業務邏輯
│   └── 可被任何項目使用
├── 業務層（business）
│   ├── UserSelect（用户選擇器）
│   ├── DepartmentTree（部門樹）
│   ├── PermissionGuard（權限守衞）
│   └── 依賴基礎層 + 業務 API
└── 複合層（composite）
    ├── SearchForm（搜索表單）
    ├── DataTable（數據表格 + 分頁 + 篩選）
    └── 由業務層和基礎層組合而成
```

## 組件 API 設計原則

```vue
{% raw %}
<!-- 原則 1：props 驅動，slot 擴展 -->
<template>
  <div class="data-table">
    <!-- 具名插槽覆蓋默認渲染 -->
    <table>
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">
            <!-- 支持自定義表頭 -->
            <slot :name="`header-${col.key}`" :column="col">
              {{ col.title }}
            </slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in displayData" :key="row[rowKey]">
          <td v-for="col in columns" :key="col.key">
            <!-- 支持自定義單元格 -->
            <slot :name="`cell-${col.key}`" :row="row" :column="col">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 作用域插槽：自定義空狀態 -->
    <slot name="empty" v-if="!displayData.length">
      <div class="empty">暫無數據</div>
    </slot>
  </div>
</template>

<script>
export default {
  name: 'DataTable',
  props: {
    // 必填：列配置
    columns: {
      type: Array,
      required: true,
      validator: (cols) => cols.every(c => c.key && c.title),
    },
    // 必填：數據
    data: { type: Array, default: () => [] },
    // 行唯一標識
    rowKey: { type: String, default: 'id' },
    // 分頁
    pagination: {
      type: [Object, Boolean],
      default: () => ({ page: 1, pageSize: 20, total: 0 }),
    },
    // 加載狀態
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

## 原則 2：事件統一

```javascript
// 統一事件命名：on + 動詞 + 名詞
// 好的命名
this.$emit('change', value);
this.$emit('select', row);
this.$emit('page-change', { page, pageSize });
this.$emit('search', queryParams);

// 不好的命名
this.$emit('input', value);        // v-model 專用
this.$emit('update', value);       // 太模糊
this.$emit('onPageChange');        // 帶 on 前綴多餘
```

## 原則 3：樣式隔離 + 主題化

```scss
// 使用 CSS 變量實現主題
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

// 暗色主題覆蓋變量即可
[data-theme='dark'] {
  --dt-border-color: #4c4d4f;
  --dt-bg-header: #2b2b2b;
}
```

## 發佈和使用

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
// 按需引入
import { DataTable, SearchForm } from '@company/ui';

// 全量引入
import CompanyUI from '@company/ui';
Vue.use(CompanyUI);
```

## 文檔和示例

```markdown
每個組件需要：
1. Props 表格（名稱、類型、默認值、説明）
2. Events 表格
3. Slots 表格
4. 至少 3 個示例（基礎用法、進階用法、邊界情況）
5. 設計説明（什麼時候用、什麼時候不用）

推薦用 vuepress 或 storybook 搭建文檔站。
```

## 小結

- 組件分三層：基礎組件、業務組件、複合組件，職責清晰
- API 設計遵循 props 驅動 + slot 擴展，減少使用者的理解成本
- CSS 變量實現主題化，不用預處理器也能覆蓋樣式
- 每個組件都需要完整文檔和示例，降低團隊學習成本
- 內部組件庫不追求大而全，解決團隊實際痛點就好
