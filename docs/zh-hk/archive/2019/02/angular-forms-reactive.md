---
title: "Angular 響應式表單完全指南"
date: 2019-02-24 10:12:24
tags:
  - Angular
readingTime: 1
description: "Angular 提供模板驅動和響應式兩種表單方案，響應式表單更適合複雜業務場景。"
---

Angular 提供模板驅動和響應式兩種表單方案，響應式表單更適合複雜業務場景。

## 基礎用法

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

## 動態表單

```typescript
get hobbies() {
  return this.form.get('hobbies') as FormArray;
}

addHobby() {
  this.hobbies.push(this.fb.control(''));
}
```

## 自定義驗證器

```typescript
function noWhitespace(control: AbstractControl) {
  return (control.value || '').trim().length === 0
    ? { whitespace: true } : null;
}
```

響應式表單讓驗證邏輯、數據流都在組件類中統一管理，易於測試。