---
title: "Angular Reactive Forms：动态表单与复杂验证实战"
date: 2020-04-05 10:14:23
tags:
  - React
---

Angular 提供了两种表单方案：Template-driven 和 Reactive Forms。对于需要动态字段、跨字段验证、程序化控制的复杂场景，Reactive Forms 是唯一合适的选择。

## 基础结构

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

## 动态表单：FormArray

常见场景：用户可动态添加/删除联系方式：

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

## 异步验证器

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

## 表单状态监听

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

## 总结

Angular Reactive Forms 的强大之处在于**表单逻辑完全在 TypeScript 中**，便于测试和复用。核心三件套：`FormGroup`（字段组）、`FormArray`（动态列表）、异步验证器，掌握这三个就能应对 90% 的复杂表单场景。
