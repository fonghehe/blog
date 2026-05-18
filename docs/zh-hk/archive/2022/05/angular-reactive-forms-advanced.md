---
title: "Angular 響應式表單進階：動態表單與自定義驗證器"
date: 2022-05-18 11:47:31
tags:
  - React
  - Angular
readingTime: 2
description: "Angular 的響應式表單（Reactive Forms）在複雜表單場景下遠比模板驅動表單更可控。這篇文章聚焦三個進階場景：動態添加/刪除表單項（FormArray）、跨字段聯合驗證器、以及實現自定義可重用的表單控件（ControlValueAccessor）。"
---

Angular 的響應式表單（Reactive Forms）在複雜表單場景下遠比模板驅動表單更可控。這篇文章聚焦三個進階場景：動態添加/刪除表單項（FormArray）、跨字段聯合驗證器、以及實現自定義可重用的表單控件（ControlValueAccessor）。

## FormArray：動態表單項

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
          <input formControlName="name" placeholder="商品名稱" />
          <input formControlName="qty" type="number" placeholder="數量" />
          <input formControlName="price" type="number" placeholder="單價" />
          <button type="button" (click)="removeItem(i)">刪除</button>
        </div>
      </div>
      <button type="button" (click)="addItem()">添加商品</button>
      <p>合計：{{ total | currency: "CNY" }}</p>
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

## 跨字段驗證器

```typescript
// validators/password-match.validator.ts
export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get("password")?.value;
    const confirm = group.get("confirmPassword")?.value;

    if (password && confirm && password !== confirm) {
      // 在 confirmPassword 控件上設置錯誤
      group.get("confirmPassword")?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    // 如果之前設置了 passwordMismatch 錯誤，清除它
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

// 註冊表單
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

## 異步驗證器（用户名唯一性檢查）

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
      catchError(() => of(null)), // API 失敗時不阻塞提交
    );
  };
}

// 在組件中使用
username = new FormControl("", {
  validators: [Validators.required, Validators.minLength(3)],
  asyncValidators: [usernameTakenValidator(this.userService)],
  updateOn: "blur", // 失去焦點時才觸發驗證
});
```

## ControlValueAccessor：自定義表單控件

實現一個星級評分組件，可以在 `[formControl]` 或 `[(ngModel)]` 中使用：

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

  // Angular 調用此方法將值寫入組件（外部 → 內部）
  writeValue(value: number) {
    this.value = value || 0;
  }

  // 註冊外部監聽器（內部 → 外部）
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

## 表單狀態可視化

```typescript
// 在開發階段快速展示表單狀態（Debug 用）
@Component({
  template: `
    <form [formGroup]="form">
      <!-- 表單內容 -->
    </form>
    <!-- 開發調試面板 -->
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

## 總結

Angular 響應式表單的進階能力——`FormArray` 的動態增刪、跨字段驗證器、`ControlValueAccessor` 自定義控件——覆蓋了絕大多數複雜業務表單場景。這套 API 雖然比 `ngModel` 囉嗦，但換來的是完整的類型安全和可測試性（Angular 14 之後表單還將引入更強的類型推斷，敬請期待）。