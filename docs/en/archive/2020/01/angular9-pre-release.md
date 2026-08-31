---
title: "Angular 9 RC Preview: Ivy Enabled by Default and strictTemplates Deep Dive"
date: 2020-01-28 10:12:20
tags:
  - Angular
readingTime: 2
description: "Angular 9 is in the final stretch of its release candidate (RC) phase, with the stable release expected in February 2020. While Ivy was opt-in in Angular 8, Angular 9 makes it the default rendering engine, and AOT compilation also becomes the default mode. Getting familiar with these changes during the RC phase is well worth the effort."
wordCount: 302
---

Angular 9 is in the final stretch of its release candidate (RC) phase, with the stable release expected in February 2020. While Ivy was opt-in in Angular 8, Angular 9 makes it the default rendering engine, and AOT compilation also becomes the default mode. Getting familiar with these changes during the RC phase is well worth the effort.

## Why Ivy Is a Qualitative Leap

The traditional View Engine generates `.ngfactory.ts` files, and its compiled output is tightly coupled to framework code, which hurts tree-shaking. Ivy's core idea is to **embed the rendering instructions directly inside the component class**:

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

The result: unused framework features (such as `@Pipe` and some CDK utilities) are no longer bundled.

## AOT Becomes the Default for Development Mode

Previously, development used JIT (fast but lenient) while production used AOT (slow but correct). This led to the classic problem of "it works locally, but fails in production":

```bash
# Angular 8：开发用 JIT，只在 build --prod 时用 AOT
ng serve            # JIT
ng build --prod     # AOT

# Angular 9：两种模式都用 AOT
ng serve            # AOT（发现更多编译期错误）
ng build --prod     # AOT
```

## strictTemplates: Strict Template Checking

This is the configuration most worth understanding ahead of time during the RC phase. Once enabled, type errors in templates are reported at build time:

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

### Commonly Caught Errors

**1. @Input type mismatch**

```typescript
// 组件定义
@Input() count: number;

// 模板
<app-counter [count]="'hello'"></app-counter>
// strictTemplates: error TS2322: Type 'string' is not assignable to type 'number'
```

**2. Accessing a non-existent property**

```html
{% raw %}
<!-- user 类型为 { name: string }，没有 age -->
<p>{{ user.age }}</p>
<!-- strictTemplates: error - Property 'age' does not exist -->
{% endraw %}
```

**3. Type narrowing after \*ngIf**

```html
{% raw %}
<!-- strictTemplates 下 TypeScript 类型收窄可以正确工作 -->
<div *ngIf="user">
  {{ user.name }}
  <!-- user 在这里被推断为非 null -->
</div>
{% endraw %}
```

## Notes on Migration

**ViewChild now requires the `static` option**

In the RC, `@ViewChild` and `@ContentChild` must explicitly declare `static`:

```typescript
// 在 ngOnInit 中使用 → static: true
@ViewChild('myEl', { static: true }) myEl: ElementRef;

// 在 ngAfterViewInit 中使用（或条件性显示）→ static: false
@ViewChild('myEl', { static: false }) myEl: ElementRef;
```

**Third-party library compatibility**

Ivy uses `ngcc` (the Angular Compatibility Compiler) to automatically convert libraries that haven't been adapted for Ivy at install time. Most cases are handled automatically, but if you run into issues you can run it manually:

```bash
node_modules/.bin/ngcc
```

## Summary

Angular 9's two core changes—Ivy enabled by default and AOT as the default development mode—put an end to the "works locally, fails in production" problem. Start getting familiar with strictTemplates errors during the RC phase so you'll run into fewer pitfalls when you upgrade after the stable release.
