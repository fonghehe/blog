---
title: "Angular 8 Ivy 渲染引擎：差异化加载与 Web Worker 支持"
date: 2019-07-31 15:52:46
tags:
  - Angular
readingTime: 1
description: "Angular 8 于 2019 年 5 月 28 日正式发布。Ivy 以 opt-in 方式进入预览，差异化加载默认开启。实际体验了一个月，来讲讲升级经验和各项功能的实际效果。"
---

Angular 8 于 2019 年 5 月 28 日正式发布。Ivy 以 opt-in 方式进入预览，差异化加载默认开启。实际体验了一个月，来讲讲升级经验和各项功能的实际效果。

## 差异化加载：默认开启

**构建后的产物变化**

```
# Angular 7 （老）
dist/
  main.js          # 所有浏览器的 ES5 包

# Angular 8 （新）
dist/
  main-es2015.js   # 现代浏览器（Chrome 61+, Firefox 60+）
  main-es5.js      # 老浏览器（IE11 备用）
```

自动生成的 HTML：

```html
<script type="module" src="main-es2015.js"></script>
<script nomodule src="main-es5.js"></script>
```

实测数据（操个中等规模 Angular 项目）：

- 现代浏览器下 main bundle **减小 20%+**
- 运行时解析速度明显提升

## Ivy opt-in 使用过程

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

开启 Ivy 后的变化：

**构建输出**：组件的 factory 和 渲染代码直接生成到组件文件旁边，而不是单独的 `ngfactory` 文件。

```typescript
// 之前：会生成 user.component.ngfactory.ts
// Ivy 之后：部署图 (instructions) 内嵌在组件类里
static ɵcmp = defineComponent({...}); // 编译器生成
```

## ngcc 兼容编译器

Ivy 需要所有依赖也是 Ivy 格式。对于还没用 Ivy 编译的第三方库，Angular 提供了 `ngcc`（Angular Compatibility Compiler）在安装时自动转换：

```bash
# 安装依赖后自动运行 ngcc
# 也可手动执行
node_modules/.bin/ngcc
```

## Web Worker CLI 支持

```bash
ng generate web-worker heavy-task
# 生成 src/app/heavy-task.worker.ts
```

```typescript
// heavy-task.worker.ts
onmessage = ({ data }) => {
  // 这里的计算不会阻塞主线程
  const result = data.reduce((sum: number, n: number) => sum + n * n, 0);
  postMessage(result);
};

// component.ts 中使用
export class AppComponent {
  compute(data: number[]) {
    const worker = new Worker("./heavy-task.worker", { type: "module" });
    worker.onmessage = ({ data: result }) => {
      this.result = result;
    };
    worker.postMessage(data);
  }
}
```

## 升级建议

```bash
# 升级命令
 ng update @angular/cli @angular/core

# CLI 会自动将字符串 loadChildren 转成 import() 语法
# 如果用了 ViewChild(‘...’)，提示需要加 { static: true/false }
```

## 总结

Angular 8 的差异化加载是对现有项目影响最大的运行时改进。Ivy 还在预览阶段，但已可以开始梳理自己项目的 `ViewChild` 静态查询和惰性加载写法，为 Angular 9 的 Ivy 默认开启做好准备。
