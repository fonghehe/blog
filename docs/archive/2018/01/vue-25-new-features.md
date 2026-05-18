---
title: "Vue 2.5 新特性实践：TypeScript 支持与错误处理改进"
date: 2018-01-02 16:03:54
tags:
  - Vue
readingTime: 2
description: "Vue 2.5 在 2017 年 10 月发布，带来了几个对日常开发影响较大的改进。用了两个月后，总结一下实际使用体验。"
---

Vue 2.5 在 2017 年 10 月发布，带来了几个对日常开发影响较大的改进。用了两个月后，总结一下实际使用体验。

## 更好的 TypeScript 支持

这是 2.5 最值得关注的更新。之前用 TypeScript 写 Vue 组件，必须依赖 `vue-class-component` 装饰器语法，体验比较割裂。2.5 之后，Vue 的类型定义做了大幅改进，即使不用 class 风格也能获得不错的类型推断。

```typescript
// 现在可以直接用 Vue.extend 获得类型检查
import Vue from "vue";

export default Vue.extend({
  data() {
    return {
      message: "Hello",
      count: 0,
    };
  },
  computed: {
    doubleCount(): number {
      return this.count * 2;
    },
  },
  methods: {
    increment() {
      this.count++;
    },
  },
});
```

`this` 上的属性现在有了正确的类型推断，在方法里访问 `this.message` 不再是 `any`。

## 函数式组件的改进

2.5 之前，函数式组件（functional component）只支持单文件组件（SFC）形式，模板里无法直接用。现在可以在模板里声明函数式组件了：

```html
{% raw %}
<template functional>
  <div class="user-card">
    <h3>{{ props.name }}</h3>
    <p>{{ props.email }}</p>
  </div>
</template>

<script>
  export default {
    functional: true,
    props: {
      name: String,
      email: String,
    },
  };
</script>
{% endraw %}
```

函数式组件没有响应式状态，没有生命周期，渲染开销更小。适合纯展示型的叶子组件。

## errorCaptured 钩子

这是我觉得最实用的新特性。之前一个子组件的渲染错误会直接让整个应用崩溃，没有任何拦截机制。2.5 引入了 `errorCaptured` 生命周期钩子：

```javascript
export default {
  name: "ErrorBoundary",
  data() {
    return {
      hasError: false,
      error: null,
    };
  },
  errorCaptured(err, vm, info) {
    this.hasError = true;
    this.error = err;
    // 返回 false 可以阻止错误继续向上传播
    return false;
  },
};
```

配合模板里的条件渲染，可以做出类似 React Error Boundary 的效果：

```html
<template>
  <div>
    <div v-if="hasError" class="error-fallback">
      <p>组件加载失败，请刷新重试</p>
    </div>
    <slot v-else></slot>
  </div>
</template>
```

在业务代码里，把不稳定的第三方组件或动态加载的组件包裹在这个 ErrorBoundary 里，避免单点故障影响全局。

## v-on 多事件处理

一个小改进，但挺常用：

```html
<!-- 之前需要写两个 v-on -->
<input @keyup.enter="submit" @keyup.esc="cancel" />

<!-- 2.5 可以这样写 -->
<button v-on="{ mousedown: doThis, mouseup: doThat }"></button>
```

对于需要动态绑定多个事件的场景，代码更简洁。

## 升级建议

如果你的项目还在 Vue 2.4，升级到 2.5 基本没有破坏性变更，直接跑 `npm update vue` 就行。如果在用 TypeScript，配合更新 `@types/vue` 后，IDE 的补全体验会有明显提升。

---

_下一篇：Webpack 3 代码分割实践_
