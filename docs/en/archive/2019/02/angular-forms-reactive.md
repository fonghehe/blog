---
title: "Angular Reactive Forms: A Complete Guide"
date: 2019-02-24 10:12:24
tags:
  - Angular
readingTime: 1
description: "Angular provides two form approaches: template-driven and reactive. Reactive forms are better suited for complex business scenarios."
wordCount: 40
---

Angular provides two form approaches: template-driven and reactive. Reactive forms are better suited for complex business scenarios.

## Basic Usage

```typescript
@Component({
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="email" />
      <span *ngIf="form.get('email')?.errors?.['required']">Required</span>
      <button type="submit">Submit</button>
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

## Dynamic Forms

```typescript
get hobbies() {
  return this.form.get('hobbies') as FormArray;
}

addHobby() {
  this.hobbies.push(this.fb.control(''));
}
```

## Custom Validators

```typescript
function noWhitespace(control: AbstractControl) {
  return (control.value || "").trim().length === 0
    ? { whitespace: true }
    : null;
}
```

Reactive forms centralize validation logic and data flow within the component class, making them easy to test.
