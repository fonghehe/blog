---
title: "Angular Reactive Forms：動態表單與複雜驗證實戰"
date: 2020-04-05 10:14:23
tags:
  - React
readingTime: 2
description: "Angular 提供了兩種表單方案：Template-driven 和 Reactive Forms。對於需要動態字段、跨字段驗證、程序化控制的複雜場景，Reactive Forms 是唯一合適的選擇。"
---

Angular 提供了兩種表單方案：Template-driven 和 Reactive Forms。對於需要動態字段、跨字段驗證、程序化控制的複雜場景，Reactive Forms 是唯一合適的選擇。

## 基礎結構

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
      <input formControlName="email" placeholder="郵箱" />
      <div *ngIf="email.invalid && email.touched">
        <span *ngIf="email.errors?.required">郵箱必填</span>
        <span *ngIf="email.errors?.email">格式不正確</span>
      </div>

      <input formControlName="password" type="password" />
      <input formControlName="confirmPassword" type="password" />
      <div *ngIf="form.errors?.passwordMismatch">兩次密碼不一致</div>

      <button type="submit" [disabled]="form.invalid">註冊</button>
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

## 動態表單：FormArray

常見場景：用户可動態添加/刪除聯繫方式：

```typescript
@Component({
  template: `
    <div formArrayName="contacts">
      <div
        *ngFor="let contact of contacts.controls; let i = index"
        [formGroupName]="i"
      >
        <select formControlName="type">
          <option value="email">郵箱</option>
          <option value="phone">手機</option>
        </select>
        <input formControlName="value" />
        <button type="button" (click)="removeContact(i)">刪除</button>
      </div>
    </div>
    <button type="button" (click)="addContact()">添加聯繫方式</button>
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

## 異步驗證器

```typescript
// 驗證用户名是否被佔用（調用後端 API）
@Injectable({ providedIn: "root" })
export class UsernameValidator {
  constructor(private userService: UserService) {}

  validate(control: AbstractControl) {
    return timer(400).pipe(
      // 防抖 400ms
      switchMap(() => this.userService.checkUsername(control.value)),
      map((taken) => (taken ? { usernameTaken: true } : null)),
      catchError(() => of(null)), // 網絡錯誤不阻止提交
    );
  }
}

// 使用
this.fb.control("", {
  validators: Validators.required,
  asyncValidators: this.usernameValidator.validate.bind(this.usernameValidator),
  updateOn: "blur", // 失焦時才觸發驗證，減少 API 調用
});
```

## 表單狀態監聽

```typescript
ngOnInit() {
  // 監聽整個表單變化
  this.form.valueChanges.pipe(
    debounceTime(500),
    distinctUntilChanged(),
    takeUntil(this.destroy$)
  ).subscribe(value => {
    this.autoSave(value);
  });

  // 聯動：選擇"企業"類型時，顯示税號字段
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

## 總結

Angular Reactive Forms 的強大之處在於**表單邏輯完全在 TypeScript 中**，便於測試和複用。核心三件套：`FormGroup`（字段組）、`FormArray`（動態列表）、異步驗證器，掌握這三個就能應對 90% 的複雜表單場景。
