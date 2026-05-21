---
title: "React 20 原生表单支持"
date: 2025-01-07 10:00:00
tags:
  - React
readingTime: 2
description: "React 20 终于补齐了表单处理的最后一块拼图。新增的原生表单组件和 hook 让你可以彻底告别第三方表单库，同时获得更好的 DX 和性能。"
wordCount: 394
---

React 20 终于补齐了表单处理的最后一块拼图。新增的原生表单组件和 hook 让你可以彻底告别第三方表单库，同时获得更好的 DX 和性能。

## useFormStatus 与 form 原语

React 20 引入了 `<Form>` 组件，它自动处理提交、验证、pending 状态和错误展示，而 `useFormStatus` 让你可以从任何子组件中读取表单状态。

```javascript
import { Form, useFormStatus } from 'react';

function SubmitButton() {
  const { pending, data, method, action } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner size={16} />
          提交中...
        </>
      ) : '提交订单'}
    </button>
  );
}

function CheckoutForm({ cartItems }) {
  const handleSubmit = async (formData) => {
    const order = await api.createOrder({
      items: cartItems,
      address: formData.get('address'),
      note: formData.get('note'),
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

`<Form>` 组件在客户端拦截提交，自动进入 transition，同时保留了 HTML form 的渐进增强行为——JS 加载失败时也能正常提交。

## useField：原生字段状态管理

`useField` 是 React 20 的杀手级 API，提供了字段级别的值、验证、touched/dirty 状态。

```javascript
import { useField, Form } from 'react';

function RegistrationForm() {
  const email = useField({
    name: 'email',
    validate: async (value) => {
      if (!value.includes('@')) return '请输入有效的邮箱';
      const exists = await api.checkEmail(value);
      if (exists) return '该邮箱已注册';
      return null;
    },
    debounce: 300,
  });

  const password = useField({
    name: 'password',
    validate: (value) => {
      if (value.length < 8) return '密码至少 8 位';
      if (!/[A-Z]/.test(value)) return '需要包含大写字母';
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
        {password.error && <span className="field-error">{password.error}</span>}
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

`useField` 的 `inputProps` 自动绑定 `onChange`、`onBlur`、`value` 等属性，减少了大量样板代码。异步验证的 debounce 也是开箱即用。

## 表单数组与嵌套对象

复杂表单中最难处理的是动态数组和嵌套结构。React 20 的 `useFieldArray` 解决了这个问题：

```javascript
import { useFieldArray, Form } from 'react';

function InvoiceForm() {
  const items = useFieldArray({
    name: 'items',
    defaultValue: [{ name: '', quantity: 1, price: 0 }],
  });

  return (
    <Form action={submitInvoice}>
      {items.fields.map((field, index) => (
        <div key={field.key} className="line-item">
          <input {...field.getInputProps('name')} placeholder="商品名称" />
          <input {...field.getInputProps('quantity')} type="number" min={1} />
          <input {...field.getInputProps('price')} type="number" step={0.01} />
          <button type="button" onClick={() => items.remove(index)}>
            删除
          </button>
        </div>
      ))}
      <button type="button" onClick={() => items.append({ name: '', quantity: 1, price: 0 })}>
        添加商品
      </button>
      <p>合计: ¥{items.fields.reduce((sum, f) => sum + f.value.quantity * f.value.price, 0).toFixed(2)}</p>
      <button type="submit">开具发票</button>
    </Form>
  );
}
```

`field.key` 是稳定的标识符，不会因为数组重排而变，这解决了 React 列表渲染的经典难题。

## 小结

- `<Form>` 组件提供渐进增强的表单提交，自动管理 pending 和 transition
- `useField` 支持同步/异步验证、debounce、touched/dirty 状态，告别第三方库
- `useFieldArray` 优雅处理动态数组表单，key 管理开箱即用
- 所有 API 都与 Actions v2 和 Suspense 原生集成
- 迁移成本极低：`<Form>` 是 `<form>` 的超集，现有代码无需改动即可渐进采用
