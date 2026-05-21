---
title: "Angular 8 RC 预览：Ivy 编译器与惰性加载新语法"
date: 2019-04-11 16:09:56
tags:
  - Angular
readingTime: 2
description: "Angular 8 第一个 RC 版本已发布，带来了两个备受期待的特性：可选的 Ivy 编译器预览和 `import()` 想式加载语法。"
wordCount: 425
---

Angular 8 第一个 RC 版本已发布，带来了两个备受期待的特性：可选的 Ivy 编译器预览和 `import()` 想式加载语法。

## Ivy 是什么

Ivy 是 Angular 的下一代渲染引擎。它重写了编译器和运行时，目标是：

- **更小的包体积**：tree-shaking 友好，只打包实际使用的框架功能
- **更快的重新构建**：增量编译，修改一个文件不需重新编译全项目
- **更好的调试体验**：渲染器代码可读性更强
- **未来支撑**：Server-Side Rendering、Higher-order components 等高级功能

## 开启 Ivy 预览

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

注意：Angular 8 中 Ivy 仅是 **opt-in** 预览，不推荐生产测试。完全默认开启要等 Angular 9。

## 想性加载语法变化

这是 Angular 8 **非常实用**的变化。之前用字符串加载模块路径没有类型检查，现在用原生 ES `import()` 语法，编译器可以检查路径正确性：

```typescript
// Angular 7 及之前：字符串路径
const routes: Routes = [
  {
    path: "users",
    loadChildren: "./users/users.module#UsersModule", // 旧语法
  },
];

// Angular 8+：动态 import()
const routes: Routes = [
  {
    path: "users",
    loadChildren: () =>
      import("./users/users.module").then((m) => m.UsersModule),
  },
];
```

新语法的优势：

1. IDE 跟踪路径，重命名自动更新
2. TypeScript 编译时检查路径是否存在
3. 更建议人读——清楚地看到对应关系

## Web Worker 支持

Angular 8 CLI 支持一键生成 Web Worker：

```bash
ng generate web-worker app
```

```typescript
// src/app/app.worker.ts
onmessage = ({ data }) => {
  const result = heavyComputation(data);
  postMessage(result);
};

// 在组件中使用
if (typeof Worker !== "undefined") {
  const worker = new Worker("./app.worker", { type: "module" });
  worker.postMessage({ input: largeData });
  worker.onmessage = ({ data }) => {
    this.result = data;
  };
}
```

## Differential Loading（差异化加载）

Angular 8 默认开启：现代浏览器加载 ES2015+ 包，老浏览器加载 ES5 包。

```html
<!-- 构建后自动生成 -->
<script type="module" src="main-es2015.js"></script>
<!-- 现代浏览器 -->
<script nomodule src="main-es5.js"></script>
<!-- 老浏览器备用 -->
```

现代浏览器用户可获得 **20-30% 体积减少**（无需 polyfill 和 ES5 transpile 开销）。

## 总结

Angular 8 最值得升级的地方是惰性加载语法和差异化加载，这两个功能小成本大收益。Ivy 预览即便不上生产，也很值得在开发环境尝鲜。
