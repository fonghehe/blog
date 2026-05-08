---
title: "企业级组件库设计思路"
date: 2020-03-18 16:39:59
tags:
  - 工程化
---

团队在管理后台项目中积累了几十个业务组件，但散落在各个项目里，复用靠复制粘贴。决定抽离出一个内部组件库，记录一下设计思路。

## 组件分层

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

## 组件 API 设计原则

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

## 原则 2：事件统一

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

## 原则 3：样式隔离 + 主题化

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

## 发布和使用

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

## 文档和示例

```markdown
每个组件需要：
1. Props 表格（名称、类型、默认值、说明）
2. Events 表格
3. Slots 表格
4. 至少 3 个示例（基础用法、进阶用法、边界情况）
5. 设计说明（什么时候用、什么时候不用）

推荐用 vuepress 或 storybook 搭建文档站。
```

## 小结

- 组件分三层：基础组件、业务组件、复合组件，职责清晰
- API 设计遵循 props 驱动 + slot 扩展，减少使用者的理解成本
- CSS 变量实现主题化，不用预处理器也能覆盖样式
- 每个组件都需要完整文档和示例，降低团队学习成本
- 内部组件库不追求大而全，解决团队实际痛点就好
