---
title: "React 20 Forms：Formコンポーネント、useField、useFieldArrayの完全ガイド"
date: 2025-01-07 10:00:00
tags:
  - React
readingTime: 3
description: "React 20はフォーム処理にネイティブのサポートを追加しました。`<Form>`コンポーネント、`useField`、`useFieldArray`の3つの新APIによって、フォームライブラリなしでも複雑なフォームを宣言的に構築できるようになりました。"
wordCount: 420
---

React 20はフォーム処理にネイティブのサポートを追加しました。`<Form>`コンポーネント、`useField`、`useFieldArray`の3つの新APIによって、フォームライブラリなしでも複雑なフォームを宣言的に構築できるようになりました。

> 注：本記事はReact 20 RCに基づいています。APIは正式リリース時に変更となる場合があります。

## `<Form>`コンポーネント

React 20の`<Form>`は`<form>`のラッパーで、Server Actionsとの統合、リセット処理、検証状態の管理を一元化します。

```typescript
import { Form } from "react";
import { createUser } from "./actions";

function CreateUserForm() {
  return (
    // Form コンポーネント：action に Server Action を渡す
    <Form action={createUser}>
      {({ isSubmitting, errors, reset }) => (
        <>
          <input name="name" placeholder="名前" />
          {errors?.name && <span className="error">{errors.name}</span>}

          <input name="email" type="email" placeholder="メールアドレス" />
          {errors?.email && <span className="error">{errors.email}</span>}

          <div className="actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "作成中..." : "ユーザーを作成"}
            </button>
            <button type="button" onClick={reset}>リセット</button>
          </div>
        </>
      )}
    </Form>
  );
}
```

```typescript
// Server Action 側：検証エラーを返す形式
"use server";

import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "名前は2文字以上で入力してください"),
  email: z.string().email("メールアドレスの形式が正しくありません"),
});

export async function createUser(prevState: unknown, formData: FormData) {
  const result = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!result.success) {
    // React 20 Form コンポーネントが受け取るエラー形式
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  await db.user.create({ data: result.data });
  return { success: true };
}
```

## useField：フィールドレベルのバリデーション

`useField`は単一フィールドの状態（値、エラー、タッチ状態）を管理するフックです。

```typescript
import { useField } from "react";

function EmailField({ name = "email" }: { name?: string }) {
  const {
    value,
    onChange,
    onBlur,
    error,      // バリデーションエラーメッセージ
    touched,    // ユーザーがフィールドに触れたか
    isDirty,    // 初期値から変更されたか
  } = useField(name, {
    validate: (value: string) => {
      if (!value) return "メールアドレスは必須です";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "メールアドレスの形式が正しくありません";
      }
      return null; // エラーなし
    },
    validateOn: "blur", // "change" | "blur" | "submit"
  });

  return (
    <div className={`field ${error && touched ? "field--error" : ""}`}>
      <label htmlFor={name}>メールアドレス</label>
      <input
        id={name}
        name={name}
        type="email"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={!!(error && touched)}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && touched && (
        <span id={`${name}-error`} className="field__error">
          {error}
        </span>
      )}
    </div>
  );
}
```

## useFieldArray：動的フィールドリスト

`useFieldArray`は動的に増減するフィールドリスト（連絡先の追加、アイテムリストなど）を管理します。

```typescript
import { useFieldArray } from "react";

type Attendee = { name: string; email: string };

function EventRegistrationForm() {
  const {
    fields,
    append,
    remove,
    move,
    update,
  } = useFieldArray<Attendee>("attendees", {
    defaultValue: [{ name: "", email: "" }], // 初期値：1件
    min: 1,  // 最低1件は必須
    max: 10, // 最大10件まで
  });

  return (
    <Form action={registerEvent}>
      <h2>参加者登録</h2>

      {fields.map((field, index) => (
        <div key={field.id} className="attendee-row">
          <input
            name={`attendees.${index}.name`}
            defaultValue={field.name}
            placeholder={`参加者 ${index + 1} の名前`}
          />
          <input
            name={`attendees.${index}.email`}
            type="email"
            defaultValue={field.email}
            placeholder={`参加者 ${index + 1} のメールアドレス`}
          />

          <button
            type="button"
            onClick={() => remove(index)}
            disabled={fields.length <= 1} // 最後の1件は削除不可
            aria-label={`参加者 ${index + 1} を削除`}
          >
            削除
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => append({ name: "", email: "" })}
        disabled={fields.length >= 10} // 最大10件
      >
        参加者を追加
      </button>

      <button type="submit">登録する</button>
    </Form>
  );
}
```

## Form + useField + useFieldArray の組み合わせ

実際のフォームでは3つのAPIを組み合わせて使います：

```typescript
function ComplexOrderForm() {
  const nameField = useField("customerName", {
    validate: (v) => (!v ? "名前は必須です" : null),
  });

  const { fields: items, append, remove } = useFieldArray("items", {
    defaultValue: [{ productId: "", quantity: 1 }],
  });

  return (
    <Form action={createOrder}>
      {({ isSubmitting, errors }) => (
        <>
          {/* useField で管理するフィールド */}
          <div>
            <input
              name="customerName"
              {...nameField.inputProps} // value, onChange, onBlur を自動展開
              placeholder="お客様名"
            />
            {nameField.error && nameField.touched && (
              <span>{nameField.error}</span>
            )}
          </div>

          {/* useFieldArray で管理する動的リスト */}
          {items.map((item, i) => (
            <div key={item.id}>
              <select name={`items.${i}.productId`}>
                <option value="">商品を選択</option>
                {/* ... */}
              </select>
              <input
                type="number"
                name={`items.${i}.quantity`}
                defaultValue={item.quantity}
                min={1}
              />
              <button type="button" onClick={() => remove(i)}>削除</button>
            </div>
          ))}

          <button type="button" onClick={() => append({ productId: "", quantity: 1 })}>
            商品を追加
          </button>

          <button type="submit" disabled={isSubmitting}>注文する</button>
        </>
      )}
    </Form>
  );
}
```

## まとめ

React 20のネイティブフォームAPIは、React Hook FormやFormikのような外部ライブラリへの依存を減らし、Server ActionsとのシームレスなファーストクラスのフォームサポートをReact本体に統合します。既存のフォームライブラリは引き続き動作しますが、新しいプロジェクトではまずネイティブAPIの採用を検討する価値があります。
