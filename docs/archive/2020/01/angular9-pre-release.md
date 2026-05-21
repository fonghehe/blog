---
title: "Angular 9 RC 预览：Ivy 默认启用与 strictTemplates 详解"
date: 2020-01-28 10:12:20
tags:
  - Angular
readingTime: 2
description: "Angular 9 的 RC 阶段已进入最后冲刺，正式版预计 2020 年 2 月发布。相比 Angular 8 中 Ivy 只能 opt-in，Angular 9 将 Ivy 作为默认渲染引擎，同时 AOT 编译也将成为默认模式。在 RC 期间我们提前摸清这些变化非常有价值。"
wordCount: 428
---

Angular 9 的 RC 阶段已进入最后冲刺，正式版预计 2020 年 2 月发布。相比 Angular 8 中 Ivy 只能 opt-in，Angular 9 将 Ivy 作为默认渲染引擎，同时 AOT 编译也将成为默认模式。在 RC 期间我们提前摸清这些变化非常有价值。

## 为什么 Ivy 是一次质的飞跃

传统的 View Engine 生成 `.ngfactory.ts` 文件，编译结果与框架代码强耦合，tree-shaking 效果差。Ivy 的核心思路是**将渲染指令（instructions）直接内嵌到组件类里**：

```typescript
// View Engine 编译后（简化）
// user.component.ngfactory.ts (额外生成的文件)
export function View_UserComponent_0(...) { ... }
export const RenderType_UserComponent = ...;

// Ivy 编译后（内嵌到组件）
export class UserComponent {
  static ɵcmp = defineComponent({
    type: UserComponent,
    selectors: [['app-user']],
    template: function UserComponent_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵelementStart(0, 'div');
        ɵɵtext(1);
        ɵɵelementEnd();
      }
      if (rf & 2) {
        ɵɵadvance(1);
        ɵɵtextInterpolate(ctx.name);
      }
    }
  });
}
```

结果：未使用的框架功能（如 `@Pipe`、某些 CDK 工具）不会被打包进去。

## AOT 成为开发模式默认值

之前开发模式用 JIT（快但不严格），生产用 AOT（慢但正确）。这导致"本地测试通过，上线才报错"的经典问题：

```bash
# Angular 8：开发用 JIT，只在 build --prod 时用 AOT
ng serve            # JIT
ng build --prod     # AOT

# Angular 9：两种模式都用 AOT
ng serve            # AOT（发现更多编译期错误）
ng build --prod     # AOT
```

## strictTemplates 模板严格检查

这是 RC 期间最值得提前了解的配置。开启后，模板中的类型错误会在构建时报出：

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

### 常见被捕获的错误

**1. @Input 类型不匹配**

```typescript
// 组件定义
@Input() count: number;

// 模板
<app-counter [count]="'hello'"></app-counter>
// strictTemplates: error TS2322: Type 'string' is not assignable to type 'number'
```

**2. 访问不存在的属性**

```html
{% raw %}
<!-- user 类型为 { name: string }，没有 age -->
<p>{{ user.age }}</p>
<!-- strictTemplates: error - Property 'age' does not exist -->
{% endraw %}
```

**3. \*ngIf 后类型收窄**

```html
{% raw %}
<!-- strictTemplates 下 TypeScript 类型收窄可以正确工作 -->
<div *ngIf="user">
  {{ user.name }}
  <!-- user 在这里被推断为非 null -->
</div>
{% endraw %}
```

## 迁移中的注意事项

**ViewChild 需要 static 选项**

RC 中 `@ViewChild` 和 `@ContentChild` 必须显式声明 `static`：

```typescript
// 在 ngOnInit 中使用 → static: true
@ViewChild('myEl', { static: true }) myEl: ElementRef;

// 在 ngAfterViewInit 中使用（或条件性显示）→ static: false
@ViewChild('myEl', { static: false }) myEl: ElementRef;
```

**第三方库兼容性**

Ivy 使用 `ngcc`（Angular Compatibility Compiler）在安装时自动转换未适配 Ivy 的库。大多数情况自动处理，但如果遇到问题可手动运行：

```bash
node_modules/.bin/ngcc
```

## 总结

Angular 9 的两大核心变化——Ivy 默认启用 + AOT 开发模式默认——让"本地能跑、上线报错"成为历史。现在 RC 阶段就开始熟悉 strictTemplates 的报错，正式发布后升级才能少踩坑。
