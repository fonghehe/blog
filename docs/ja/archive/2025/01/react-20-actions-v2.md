---
title: "React 20 Actions v2：useActionState v2とuseActionフックの詳解"
date: 2025-01-03 10:00:00
tags:
  - React
readingTime: 2
description: "React 20はActionsパラダイムをさらに洗練させました。`useActionState` v2は初回レンダリングの挙動が改善され、新しい`useAction`フックによってServer Actions以外の非同期操作も統一的なパターンで扱えるようになりました。"
---

React 20はActionsパラダイムをさらに洗練させました。`useActionState` v2は初回レンダリングの挙動が改善され、新しい`useAction`フックによってServer Actions以外の非同期操作も統一的なパターンで扱えるようになりました。

## useActionState v2 の改善

React 19でリリースされた`useActionState`には1つの既知の問題がありました——`action`関数が最初の呼び出し時に`prevState`の初期値を受け取れず、`null`になることがありました。React 20では修正されています。

```typescript
// React 19 の useActionState（初回の prevState が null になる問題あり）
const [state, action] = useActionState(
  async (prevState: State | null, formData: FormData) => {
    // 初回呼び出し時、prevState は必ず null
    // 初期 state を指定しても、action 内ではアクセスできなかった
    return { ...prevState, name: formData.get("name") as string };
  },
  { name: "", email: "" }, // 初期値（UI には使われるが action 内では使えなかった）
);
```

```typescript
// React 20 useActionState v2：初回の prevState が正しく初期値を受け取れる
const [state, action, isPending] = useActionState(
  async (prevState: UserFormState, formData: FormData) => {
    // React 20：初回呼び出しでも prevState = { name: "", email: "" } が正しく入る
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;

    // バリデーション：前の state と比較できる
    if (name === prevState.name && email === prevState.email) {
      return { ...prevState, message: "変更はありません" };
    }

    const result = await updateUser({ name, email });
    return { name, email, message: result.success ? "更新しました" : "エラー" };
  },
  { name: "Alice", email: "alice@example.com", message: "" }, // 初期値
);
```

## 新フック：useAction

`useAction`は`useActionState`の「軽量版」で、Server Actionsに限定されず、どんな非同期関数も扱えます。

```typescript
import { useAction } from "react";

// 使用例1：データ取得
function SearchResults() {
  const [searchResults, searchAction, isSearching] = useAction(
    async (query: string) => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      return res.json();
    }
  );

  return (
    <div>
      <input
        placeholder="検索..."
        onChange={(e) => searchAction(e.target.value)}
      />
      {isSearching && <Spinner />}
      {searchResults?.map((item) => (
        <SearchResultItem key={item.id} item={item} />
      ))}
    </div>
  );
}
```

```typescript
// 使用例2：楽観的更新と組み合わせ
function LikeButton({ postId, initialLikes }: Props) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(initialLikes);

  const [, likeAction, isLiking] = useAction(async () => {
    addOptimisticLike((likes) => likes + 1); // 楽観的に更新
    try {
      await toggleLike(postId); // Server Action
    } catch {
      addOptimisticLike((likes) => likes - 1); // 失敗時にロールバック
    }
  });

  return (
    <button onClick={() => likeAction()} disabled={isLiking}>
      ❤️ {optimisticLikes}
    </button>
  );
}
```

## useActionState + useAction の使い分け

```
使い分けガイド：

useActionState：
  - フォーム送信（<form action={action}>）
  - 前の state を次の action に引き継ぐ必要があるとき
  - Server Actions と組み合わせるとき

useAction：
  - フォーム以外の非同期操作（ボタンクリック、検索など）
  - state の引き継ぎが不要なとき
  - クライアントサイドのみの非同期処理にも使いたいとき
```

```typescript
// 組み合わせの例：フォーム（useActionState）+ 追加アクション（useAction）
function ProfileEditor({ user }: { user: User }) {
  // フォーム送信には useActionState
  const [formState, submitAction, isSubmitting] = useActionState(
    updateProfileAction,
    { ...user, message: "" }
  );

  // アバター削除には useAction（フォームと独立したアクション）
  const [, deleteAvatarAction, isDeletingAvatar] = useAction(async () => {
    await deleteAvatar(user.id);
  });

  return (
    <form action={submitAction}>
      <input name="name" defaultValue={formState.name} />
      <input name="bio" defaultValue={formState.bio} />

      {/* アバター削除は独立したアクション */}
      <button
        type="button"
        onClick={() => deleteAvatarAction()}
        disabled={isDeletingAvatar}
      >
        アバターを削除
      </button>

      <button type="submit" disabled={isSubmitting}>保存</button>
      {formState.message && <p>{formState.message}</p>}
    </form>
  );
}
```

## エラーハンドリングの改善

React 20では`useActionState`と`useAction`のエラーハンドリングが改善されました：

```typescript
const [state, action, isPending] = useActionState(
  async (prevState: State, data: FormData) => {
    try {
      const result = await submitForm(data);
      return { success: true, data: result, error: null };
    } catch (error) {
      // React 20：エラーを state として返せば、ErrorBoundary に伝播しない
      // エラーをそのまま throw すると ErrorBoundary に伝播する（使い分け可能）
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "不明なエラー",
      };
    }
  },
  { success: false, data: null, error: null },
);
```

## まとめ

React 20のActions v2の改善は細かいながらも重要です——`useActionState`の`prevState`バグ修正によって初期値を正しく扱えるようになり、`useAction`の追加によってフォーム以外の非同期操作も統一的なパターンで書けるようになりました。React 19でActionsを使い始めていたなら、React 20への移行は自然に行えます。
