---
title: "Angular Reactive Forms: Dynamic Forms and Complex Validation in Practice"
date: 2020-04-05 10:14:23
tags:
  - React
readingTime: 2
description: "Angular offers two form approaches: Template-driven and Reactive Forms. For complex scenarios requiring dynamic fields, cross-field validation, or programmatic control, Reactive Forms is the only sensible choice."
wordCount: 100
---

Angular offers two form strategies: Template-driven and Reactive Forms. For complex scenarios that need dynamic fields, cross-field validation, or programmatic control, Reactive Forms is the only sensible choice.

## Basic Structure

```typescript
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from "@angular/forms";

@Component({
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <input formControlName="email" placeholder="邮箱" />
      <div *ngIf="email.invalid && email.touched">
        <span *ngIf="email.errors?.required">邮箱必填</span>
        <span *ngIf="email.errors?.email">格式不正确</span>
      </div>

      <input formControlName="password" type="password" />
      <input formControlName="confirmPassword" type="password" />
      <div *ngIf="form.errors?.passwordMismatch">两次密码不一致</div>

      <button type="submit" [disabled]="form.invalid">注册</button>
    </form>
  `,
})
export class RegisterComponent {
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group(
      {
        email: ["", [Validators.required, Validators.email]],
        password: ["", [Validators.required, Validators.minLength(8)]],
        confirmPassword: ["", Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  get email() {
    return this.form.get("email")!;
  }

  passwordMatchValidator(group: AbstractControl) {
    const pw = group.get("password")?.value;
    const cpw = group.get("confirmPassword")?.value;
    return pw === cpw ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.form.valid) {
      console.log(this.form.value);
    }
  }
}
```

## Dynamic Forms: FormArray

A common scenario is letting users add or remove contact details dynamically:

```typescript
@Component({
  template: `
    <div formArrayName="contacts">
      <div
        *ngFor="let contact of contacts.controls; let i = index"
        [formGroupName]="i"
      >
        <select formControlName="type">
          <option value="email">邮箱</option>
          <option value="phone">手机</option>
        </select>
        <input formControlName="value" />
        <button type="button" (click)="removeContact(i)">删除</button>
      </div>
    </div>
    <button type="button" (click)="addContact()">添加联系方式</button>
  `,
})
export class ProfileFormComponent {
  form = this.fb.group({
    name: ["", Validators.required],
    contacts: this.fb.array([this.createContact()]),
  });

  get contacts() {
    return this.form.get("contacts") as FormArray;
  }

  createContact() {
    return this.fb.group({
      type: ["email"],
      value: ["", Validators.required],
    });
  }

  addContact() {
    this.contacts.push(this.createContact());
  }

  removeContact(i: number) {
    this.contacts.removeAt(i);
  }
}
```

## Async Validators

```typescript
// 验证用户名是否被占用（调用后端 API）
@Injectable({ providedIn: "root" })
export class UsernameValidator {
  constructor(private userService: UserService) {}

  validate(control: AbstractControl) {
    return timer(400).pipe(
      // 防抖 400ms
      switchMap(() => this.userService.checkUsername(control.value)),
      map((taken) => (taken ? { usernameTaken: true } : null)),
      catchError(() => of(null)), // 网络错误不阻止提交
    );
  }
}

// 使用
this.fb.control("", {
  validators: Validators.required,
  asyncValidators: this.usernameValidator.validate.bind(this.usernameValidator),
  updateOn: "blur", // 失焦时才触发验证，减少 API 调用
});
```

## Listening to Form State Changes

```typescript
ngOnInit() {
  // 监听整个表单变化
  this.form.valueChanges.pipe(
    debounceTime(500),
    distinctUntilChanged(),
    takeUntil(this.destroy$)
  ).subscribe(value => {
    this.autoSave(value);
  });

  // 联动：选择"企业"类型时，显示税号字段
  this.form.get('type')!.valueChanges.subscribe(type => {
    const taxField = this.form.get('taxId')!;
    if (type === 'company') {
      taxField.setValidators(Validators.required);
    } else {
      taxField.clearValidators();
    }
    taxField.updateValueAndValidity();
  });
}
```

## Summary

The strength of Angular Reactive Forms is that all form logic lives in TypeScript, which makes it easy to test and reuse. Master the core trio — `FormGroup` (field groups), `FormArray` (dynamic lists), and async validators — and you can handle about 90% of complex form scenarios.
