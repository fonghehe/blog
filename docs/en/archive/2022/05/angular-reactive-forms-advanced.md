---
title: "Angular Reactive Forms Advanced: Dynamic Forms and Custom Validators"
date: 2022-05-18 11:47:31
tags:
  - React
  - Angular
readingTime: 2
description: "Angular 的响应式表单（Reactive Forms）在复杂表单场景下远比模板驱动表单更可控。这篇文章聚焦三个进阶场景：动态添加/删除表单项（FormArray）、跨字段联合验证器、以及实现自定义可重用的表单控件（ControlValueAccessor）。"
---

Angular 的响应式表单（Reactive Forms）在复杂表单场景下远比模板驱动表单更可控。这篇文章聚焦三个进阶场景：动态添加/删除表单项（FormArray）、跨字段联合验证器、以及实现自定义可重用的表单控件（ControlValueAccessor）。

## FormArray：动态表单项

```typescript
@Component({
  selector: "app-invoice-form",
  template: `
    <form [formGroup]="form">
      <div formArrayName="items">
        <div
          *ngFor="let item of items.controls; let i = index"
          [formGroupName]="i"
        >
          <input formControlName="name" placeholder="商品名称" />
          <input formControlName="qty" type="number" placeholder="数量" />
          <input formControlName="price" type="number" placeholder="单价" />
          <button type="button" (click)="removeItem(i)">删除</button>
        </div>
      </div>
      <button type="button" (click)="addItem()">添加商品</button>
      <p>合计：{{ total | currency: "CNY" }}</p>
    </form>
  `,
})
export class InvoiceFormComponent {
  form = new FormGroup({
    customer: new FormControl("", Validators.required),
    items: new FormArray<FormGroup>([this.createItem()]),
  });

  get items() {
    return this.form.get("items") as FormArray;
  }

  get total() {
    return this.items.controls.reduce((sum, ctrl) => {
      const { qty, price } = ctrl.value;
      return sum + (qty || 0) * (price || 0);
    }, 0);
  }

  createItem(): FormGroup {
    return new FormGroup({
      name: new FormControl("", Validators.required),
      qty: new FormControl(1, [Validators.required, Validators.min(1)]),
      price: new FormControl(0, [Validators.required, Validators.min(0)]),
    });
  }

  addItem() {
    this.items.push(this.createItem());
  }
  removeItem(i: number) {
    this.items.removeAt(i);
  }
}
```

## 跨字段验证器

```typescript
// validators/password-match.validator.ts
export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get("password")?.value;
    const confirm = group.get("confirmPassword")?.value;

    if (password && confirm && password !== confirm) {
      // 在 confirmPassword 控件上设置错误
      group.get("confirmPassword")?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    // 如果之前设置了 passwordMismatch 错误，清除它
    const errors = group.get("confirmPassword")?.errors;
    if (errors?.["passwordMismatch"]) {
      const { passwordMismatch, ...rest } = errors;
      group
        .get("confirmPassword")
        ?.setErrors(Object.keys(rest).length ? rest : null);
    }
    return null;
  };
}

// 注册表单
const registerForm = new FormGroup(
  {
    email: new FormControl("", [Validators.required, Validators.email]),
    password: new FormControl("", [
      Validators.required,
      Validators.minLength(8),
    ]),
    confirmPassword: new FormControl("", Validators.required),
  },
  {
    validators: passwordMatchValidator(),
  },
);
```

## 异步验证器（用户名唯一性检查）

```typescript
// validators/username-taken.validator.ts
export function usernameTakenValidator(
  userService: UserService,
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);

    return timer(400).pipe(
      // 防抖 400ms
      switchMap(() => userService.checkUsername(control.value)),
      map((isTaken) => (isTaken ? { usernameTaken: true } : null)),
      catchError(() => of(null)), // API 失败时不阻塞提交
    );
  };
}

// 在组件中使用
username = new FormControl("", {
  validators: [Validators.required, Validators.minLength(3)],
  asyncValidators: [usernameTakenValidator(this.userService)],
  updateOn: "blur", // 失去焦点时才触发验证
});
```

## ControlValueAccessor：自定义表单控件

实现一个星级评分组件，可以在 `[formControl]` 或 `[(ngModel)]` 中使用：

```typescript
@Component({
  selector: "app-star-rating",
  template: `
    <span
      *ngFor="let star of [1, 2, 3, 4, 5]"
      [class.filled]="star <= value"
      [class.disabled]="isDisabled"
      (click)="!isDisabled && writeValue(star)"
      >★</span
    >
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StarRatingComponent),
      multi: true,
    },
  ],
})
export class StarRatingComponent implements ControlValueAccessor {
  value = 0;
  isDisabled = false;

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  // Angular 调用此方法将值写入组件（外部 → 内部）
  writeValue(value: number) {
    this.value = value || 0;
  }

  // 注册外部监听器（内部 → 外部）
  registerOnChange(fn: (value: number) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean) {
    this.isDisabled = disabled;
  }
}

// 使用
// <app-star-rating [formControl]="ratingControl"></app-star-rating>
// <app-star-rating [(ngModel)]="rating"></app-star-rating>
```

## 表单状态可视化

```typescript
// 在开发阶段快速展示表单状态（Debug 用）
@Component({
  template: `
    <form [formGroup]="form">
      <!-- 表单内容 -->
    </form>
    <!-- 开发调试面板 -->
    <pre *ngIf="isDevMode">{{ form.value | json }}</pre>
    <p>
      Valid: {{ form.valid }}, Dirty: {{ form.dirty }}, Touched:
      {{ form.touched }}
    </p>
  `,
})
export class FormDebugComponent {
  isDevMode = !environment.production;
}
```

## Summary

Angular 响应式表单的进阶能力——`FormArray` 的动态增删、跨字段验证器、`ControlValueAccessor` 自定义控件——覆盖了绝大多数复杂业务表单场景。这套 API 虽然比 `ngModel` 啰嗦，但换来的是完整的类型安全和可测试性（Angular 14 之后表单还将引入更强的类型推断，敬请期待）。