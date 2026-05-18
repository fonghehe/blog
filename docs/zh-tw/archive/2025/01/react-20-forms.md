---
title: "React 20 原生表單支援"
date: 2025-01-07 10:00:00
tags:
  - React
readingTime: 2
description: "React 20 終於補齊了表單處理的最後一塊拼圖。新增的原生表單元件和 hook 讓你可以徹底告別第三方表單庫，同時獲得更好的 DX 和效能。"
---

React 20 終於補齊了表單處理的最後一塊拼圖。新增的原生表單元件和 hook 讓你可以徹底告別第三方表單庫，同時獲得更好的 DX 和效能。

## useFormStatus 與 form 原語

React 20 引入了 `<Form>` 元件，它自動處理提交、驗證、pending 狀態和錯誤展示，而 `useFormStatus` 讓你可以從任何子元件中讀取表單狀態。

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
      ) : '提交訂單'}
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
      <input name="address" placeholder="收貨地址" required />
      <textarea name="note" placeholder="備註" />
      <CartSummary items={cartItems} />
      <SubmitButton />
    </Form>
  );
}
```

`<Form>` 元件在客戶端攔截提交，自動進入 transition，同時保留了 HTML form 的漸進增強行為——JS 載入失敗時也能正常提交。

## useField：原生欄位狀態管理

`useField` 是 React 20 的殺手級 API，提供了欄位級別的值、驗證、touched/dirty 狀態。

```javascript
import { useField, Form } from 'react';

function RegistrationForm() {
  const email = useField({
    name: 'email',
    validate: async (value) => {
      if (!value.includes('@')) return '請輸入有效的郵箱';
      const exists = await api.checkEmail(value);
      if (exists) return '該郵箱已註冊';
      return null;
    },
    debounce: 300,
  });

  const password = useField({
    name: 'password',
    validate: (value) => {
      if (value.length < 8) return '密碼至少 8 位';
      if (!/[A-Z]/.test(value)) return '需要包含大寫字母';
      return null;
    },
  });

  return (
    <Form action={handleRegister}>
      <div>
        <input name="email" {...email.inputProps} />
        {email.error && <span className="field-error">{email.error}</span>}
        {email.validating && <span>驗證中...</span>}
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
        註冊
      </button>
    </Form>
  );
}
```

`useField` 的 `inputProps` 自動繫結 `onChange`、`onBlur`、`value` 等屬性，減少了大量樣板程式碼。非同步驗證的 debounce 也是開箱即用。

## 表單陣列與巢狀物件

複雜表單中最難處理的是動態陣列和巢狀結構。React 20 的 `useFieldArray` 解決了這個問題：

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
          <input {...field.getInputProps('name')} placeholder="商品名稱" />
          <input {...field.getInputProps('quantity')} type="number" min={1} />
          <input {...field.getInputProps('price')} type="number" step={0.01} />
          <button type="button" onClick={() => items.remove(index)}>
            刪除
          </button>
        </div>
      ))}
      <button type="button" onClick={() => items.append({ name: '', quantity: 1, price: 0 })}>
        新增商品
      </button>
      <p>合計: ¥{items.fields.reduce((sum, f) => sum + f.value.quantity * f.value.price, 0).toFixed(2)}</p>
      <button type="submit">開具發票</button>
    </Form>
  );
}
```

`field.key` 是穩定的識別符號，不會因為陣列重排而變，這解決了 React 列表渲染的經典難題。

## 小結

- `<Form>` 元件提供漸進增強的表單提交，自動管理 pending 和 transition
- `useField` 支援同步/非同步驗證、debounce、touched/dirty 狀態，告別第三方庫
- `useFieldArray` 優雅處理動態陣列表單，key 管理開箱即用
- 所有 API 都與 Actions v2 和 Suspense 原生整合
- 遷移成本極低：`<Form>` 是 `<form>` 的超集，現有程式碼無需改動即可漸進採用
