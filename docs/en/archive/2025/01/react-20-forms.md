---
title: "React 20 Native Form Support"
date: 2025-01-07 10:00:00
tags:
  - React
readingTime: 2
description: "React 20 has finally filled the last piece of the form handling puzzle. The new native form components and hooks let you say goodbye to third-party form librari"
---

React 20 has finally filled the last piece of the form handling puzzle. The new native form components and hooks let you say goodbye to third-party form libraries entirely while gaining better DX and performance.

## useFormStatus and Form Primitives

React 20 introduces a `<Form>` component that automatically handles submission, validation, pending state, and error display. `useFormStatus` lets any child component read the form's state.

```javascript
import { Form, useFormStatus } from "react";

function SubmitButton() {
  const { pending, data, method, action } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner size={16} />
          提交中...
        </>
      ) : (
        "提交订单"
      )}
    </button>
  );
}

function CheckoutForm({ cartItems }) {
  const handleSubmit = async (formData) => {
    const order = await api.createOrder({
      items: cartItems,
      address: formData.get("address"),
      note: formData.get("note"),
    });
    redirect(`/orders/${order.id}`);
  };

  return (
    <Form action={handleSubmit} method="POST">
      <input name="address" placeholder="收货地址" required />
      <textarea name="note" placeholder="备注" />
      <CartSummary items={cartItems} />
      <SubmitButton />
    </Form>
  );
}
```

The `<Form>` component intercepts submission on the client side, automatically enters a transition, and also preserves the progressive enhancement behavior of HTML forms — they work normally even if JavaScript fails to load.

## useField: Native Field State Management

`useField` is React 20's killer API, providing per-field value, validation, and touched/dirty state management.

```javascript
import { useField, Form } from "react";

function RegistrationForm() {
  const email = useField({
    name: "email",
    validate: async (value) => {
      if (!value.includes("@")) return "请输入有效的邮箱";
      const exists = await api.checkEmail(value);
      if (exists) return "该邮箱已注册";
      return null;
    },
    debounce: 300,
  });

  const password = useField({
    name: "password",
    validate: (value) => {
      if (value.length < 8) return "密码至少 8 位";
      if (!/[A-Z]/.test(value)) return "需要包含大写字母";
      return null;
    },
  });

  return (
    <Form action={handleRegister}>
      <div>
        <input name="email" {...email.inputProps} />
        {email.error && <span className="field-error">{email.error}</span>}
        {email.validating && <span>验证中...</span>}
      </div>
      <div>
        <input name="password" type="password" {...password.inputProps} />
        {password.error && (
          <span className="field-error">{password.error}</span>
        )}
        <PasswordStrength value={password.value} />
      </div>
      <button
        type="submit"
        disabled={email.error || password.error || email.validating}
      >
        注册
      </button>
    </Form>
  );
}
```

`useField`'s `inputProps` automatically binds `onChange`, `onBlur`, `value`, and other attributes, eliminating a large amount of boilerplate. Async validation debounce also works out of the box.

## Form Arrays and Nested Objects

The hardest part of complex forms is handling dynamic arrays and nested structures. React 20's `useFieldArray` solves this:

```javascript
import { useFieldArray, Form } from "react";

function InvoiceForm() {
  const items = useFieldArray({
    name: "items",
    defaultValue: [{ name: "", quantity: 1, price: 0 }],
  });

  return (
    <Form action={submitInvoice}>
      {items.fields.map((field, index) => (
        <div key={field.key} className="line-item">
          <input {...field.getInputProps("name")} placeholder="商品名称" />
          <input {...field.getInputProps("quantity")} type="number" min={1} />
          <input {...field.getInputProps("price")} type="number" step={0.01} />
          <button type="button" onClick={() => items.remove(index)}>
            删除
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => items.append({ name: "", quantity: 1, price: 0 })}
      >
        添加商品
      </button>
      <p>
        合计: ¥
        {items.fields
          .reduce((sum, f) => sum + f.value.quantity * f.value.price, 0)
          .toFixed(2)}
      </p>
      <button type="submit">开具发票</button>
    </Form>
  );
}
```

`field.key` is a stable identifier that won't change due to array reordering, solving the classic React list rendering challenge.

## Summary

- `<Form>` component provides progressively-enhanced form submission with automatic pending and transition management
- `useField` supports synchronous/async validation, debounce, and touched/dirty state — no third-party library needed
- `useFieldArray` elegantly handles dynamic array forms with key management out of the box
- All APIs are natively integrated with Actions v2 and Suspense
- Migration cost is extremely low: `<Form>` is a superset of `<form>`, so existing code can be progressively adopted without modification
