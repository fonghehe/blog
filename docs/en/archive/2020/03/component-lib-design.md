---
title: "Enterprise Component Library Design Principles"
date: 2020-03-18 16:39:59
tags:
  - Engineering
readingTime: 2
description: "Our admin dashboard projects had accumulated dozens of business components scattered across repos, reused only by copy-pasting. We decided to extract an internal component library, and these are my notes on the design thinking behind it."
wordCount: 130
---

Our admin dashboard projects had accumulated dozens of business components, but they were scattered across different projects and only reused by copy-pasting. We decided to extract an internal component library, and these are my notes on the design thinking behind it.

## Component Layering

```
组件库
├── 基础层（primitives）
│   ├── Button、Input、Select
│   ├── 不依赖任何业务逻辑
│   └── 可被任何项目使用
├── 业务层（business）
│   ├── UserSelect（用户选择器）
│   ├── DepartmentTree（部门树）
│   ├── PermissionGuard（权限守卫）
│   └── 依赖基础层 + 业务 API
└── 复合层（composite）
    ├── SearchForm（搜索表单）
    ├── DataTable（数据表格 + 分页 + 筛选）
    └── 由业务层和基础层组合而成
```

## Component API Design Principles

```vue
{% raw %}
<!-- 原则 1：props 驱动，slot 扩展 -->
<template>
  <div class="data-table">
    <!-- 具名插槽覆盖默认渲染 -->
    <table>
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">
            <!-- 支持自定义表头 -->
            <slot :name="`header-${col.key}`" :column="col">
              {{ col.title }}
            </slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in displayData" :key="row[rowKey]">
          <td v-for="col in columns" :key="col.key">
            <!-- 支持自定义单元格 -->
            <slot :name="`cell-${col.key}`" :row="row" :column="col">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 作用域插槽：自定义空状态 -->
    <slot name="empty" v-if="!displayData.length">
      <div class="empty">暂无数据</div>
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
    // 必填：数据
    data: { type: Array, default: () => [] },
    // 行唯一标识
    rowKey: { type: String, default: 'id' },
    // 分页
    pagination: {
      type: [Object, Boolean],
      default: () => ({ page: 1, pageSize: 20, total: 0 }),
    },
    // 加载状态
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

## Principle 2: Unified Events

```javascript
// 统一事件命名：on + 动词 + 名词
// 好的命名
this.$emit('change', value);
this.$emit('select', row);
this.$emit('page-change', { page, pageSize });
this.$emit('search', queryParams);

// 不好的命名
this.$emit('input', value);        // v-model 专用
this.$emit('update', value);       // 太模糊
this.$emit('onPageChange');        // 带 on 前缀多余
```

## Principle 3: Style Isolation and Theming

```scss
// 使用 CSS 变量实现主题
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

// 暗色主题覆盖变量即可
[data-theme='dark'] {
  --dt-border-color: #4c4d4f;
  --dt-bg-header: #2b2b2b;
}
```

## Publishing and Usage

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

## Documentation and Examples

```markdown
每个组件需要：
1. Props 表格（名称、类型、默认值、说明）
2. Events 表格
3. Slots 表格
4. 至少 3 个示例（基础用法、进阶用法、边界情况）
5. 设计说明（什么时候用、什么时候不用）

推荐用 vuepress 或 storybook 搭建文档站。
```

## Summary

- Components are split into three layers—base, business, and composite—each with clearly defined responsibilities.
- API design is props-driven with slot-based extension, lowering the cognitive load for consumers.
- Theming uses CSS variables, so styles can be overridden without a preprocessor.
- Every component needs complete docs and examples to cut the team's learning curve.
- An internal component library shouldn't aim to be all-encompassing—just solve the team's real pain points.
