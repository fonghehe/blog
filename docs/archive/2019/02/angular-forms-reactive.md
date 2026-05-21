---
title: "Angular 响应式表单完全指南"
date: 2019-02-24 10:12:24
tags:
  - Angular
readingTime: 1
description: "Angular 提供模板驱动和响应式两种表单方案，响应式表单更适合复杂业务场景。"
wordCount: 74
---

Angular 提供模板驱动和响应式两种表单方案，响应式表单更适合复杂业务场景。

## 基础用法

```typescript
@Component({
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="email" />
      <span *ngIf="form.get('email')?.errors?.['required']">必填</span>
      <button type="submit">提交</button>
    </form>
  `
})
export class LoginComponent {
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor(private fb: FormBuilder) {}

  submit() {
    if (this.form.valid) {
      console.log(this.form.value);
    }
  }
}
```

## 动态表单

```typescript
get hobbies() {
  return this.form.get('hobbies') as FormArray;
}

addHobby() {
  this.hobbies.push(this.fb.control(''));
}
```

## 自定义验证器

```typescript
function noWhitespace(control: AbstractControl) {
  return (control.value || '').trim().length === 0
    ? { whitespace: true } : null;
}
```

响应式表单让验证逻辑、数据流都在组件类中统一管理，易于测试。