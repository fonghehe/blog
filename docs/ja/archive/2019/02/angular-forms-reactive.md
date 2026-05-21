---
title: "Angularリアクティブフォーム完全ガイド"
date: 2019-02-24 10:12:24
tags:
  - Angular
readingTime: 1
description: "Angularはテンプレート駆動とリアクティブの2種類のフォームアプローチを提供している。リアクティブフォームは複雑なビジネスシナリオに適している。"
wordCount: 144
---

Angularはテンプレート駆動とリアクティブの2種類のフォームアプローチを提供している。リアクティブフォームは複雑なビジネスシナリオに適している。

## 基本的な使い方

```typescript
@Component({
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="email" />
      <span *ngIf="form.get('email')?.errors?.['required']">必須</span>
      <button type="submit">送信</button>
    </form>
  `,
})
export class LoginComponent {
  form = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(8)]],
  });

  constructor(private fb: FormBuilder) {}

  submit() {
    if (this.form.valid) {
      console.log(this.form.value);
    }
  }
}
```

## 動的フォーム

```typescript
get hobbies() {
  return this.form.get('hobbies') as FormArray;
}

addHobby() {
  this.hobbies.push(this.fb.control(''));
}
```

## カスタムバリデーター

```typescript
function noWhitespace(control: AbstractControl) {
  return (control.value || "").trim().length === 0
    ? { whitespace: true }
    : null;
}
```

リアクティブフォームはバリデーションロジックとデータフローをコンポーネントクラス内で一元管理でき、テストが容易だ。
