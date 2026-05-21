---
title: "React 19 本番移行ガイド：forwardRef廃止・Context変更・useActionState・Server Actions落とし穴"
date: 2025-01-10 10:00:00
tags:
  - React
readingTime: 3
description: "React 19は2024年末に安定版リリースされ、2025年にプロジェクトの移行を検討しているチームが増えています。本記事は実際の移行で遭遇しやすい**破壊的変更**と**よくある落とし穴**を中心に、本番移行のためのガイドです。"
wordCount: 295
---

React 19は2024年末に安定版リリースされ、2025年にプロジェクトの移行を検討しているチームが増えています。本記事は実際の移行で遭遇しやすい**破壊的変更**と**よくある落とし穴**を中心に、本番移行のためのガイドです。

## 1. forwardRef の廃止：refをpropとして直接受け取る

React 19最大の変更の1つです。`forwardRef()`ラッパーが不要になり、`ref`を通常のpropとして受け取れます。

```typescript
// Before（React 18 スタイル）
import { forwardRef } from "react";

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ label, ...props }, ref) {
    return (
      <div>
        <label>{label}</label>
        <input ref={ref} {...props} />
      </div>
    );
  }
);
```

```typescript
// After（React 19 スタイル）：forwardRef 不要
function TextInput({ label, ref, ...props }: TextInputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <div>
      <label>{label}</label>
      <input ref={ref} {...props} />
    </div>
  );
}

// 呼び出し側は変わらない
const inputRef = useRef<HTMLInputElement>(null);
<TextInput ref={inputRef} label="名前" />;
```

### 移行の注意点

```typescript
// ⚠️ forwardRef を使っていたコンポーネントライブラリ（MUI, Radix UI など）
// React 19 対応版にアップグレードが必要
// → 各ライブラリの React 19 サポート状況を確認してからアップグレード

// ⚠️ コードベース全体の forwardRef を一括置換する場合
// codemod ツールを使うと安全
npx codemod@latest react/19/remove-forward-ref
```

## 2. Context：`<Context.Provider>`から`<Context>`への変更

```typescript
// Before（React 18 スタイル）
const ThemeContext = createContext<Theme>(defaultTheme);

function App() {
  return (
    <ThemeContext.Provider value={theme}>
      <AppContent />
    </ThemeContext.Provider>
  );
}

// After（React 19 スタイル）：.Provider を省略できる
function App() {
  return (
    <ThemeContext value={theme}>
      <AppContent />
    </ThemeContext>
  );
}
```

```typescript
// ⚠️ 落とし穴：<Context.Provider> は React 19 でも動作する（非推奨だが削除されていない）
// → 既存コードはそのまま動くが、新しいコードは <Context> 形式を使う
// → Lintルールで強制することを推奨

// eslint-disable-next-line react/no-deprecated
// <ThemeContext.Provider> を検出して警告するカスタムLintルール
```

## 3. useActionState：よくある落とし穴

```typescript
// ⚠️ 落とし穴1：useFormState（React 18 の名前）から useActionState（React 19）へ
// Before
import { useFormState } from "react-dom"; // 削除済み！

// After
import { useActionState } from "react"; // react-dom ではなく react から！
```

```typescript
// ⚠️ 落とし穴2：action 関数のシグネチャが変わった
// Before（useFormState）：(prevState, formData) — prevState が先
// After（useActionState）：(prevState, formData) — 同じだが型が変わった

const [state, action] = useActionState(
  // 第1引数：prevState（初回は initialState の値）
  // 第2引数：formData（フォームから）または action に渡した引数
  async (prevState: State, formData: FormData) => {
    const name = formData.get("name") as string;
    return { ...prevState, name };
  },
  { name: "" }, // initialState
);
```

```typescript
// ⚠️ 落とし穴3：isPending が第3戻り値になった（React 19）
// Before（React 18 の useFormState）：[state, dispatch] の2要素
// After（React 19 の useActionState）：[state, dispatch, isPending] の3要素

const [state, action, isPending] = useActionState(myAction, initialState);
//                      ↑ 忘れやすい！
```

## 4. Server Actions：本番でのよくある落とし穴

```typescript
// ⚠️ 落とし穴1：Server Action はシリアライズ可能な値しか返せない
"use server";

// ❌ エラー：クラスインスタンスは返せない
export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user; // Prisma オブジェクトは返せる場合と返せない場合がある
}

// ✅ 正しい：プレーンオブジェクトに変換
export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  // シリアライズ可能なプレーンオブジェクトとして返す
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(), // Date → string
  };
}
```

```typescript
// ⚠️ 落とし穴2：Server Action 内でのエラーハンドリング
"use server";

// ❌ エラーをそのまま throw すると、エラーメッセージがクライアントに漏れる
export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
  // DB エラーの詳細がクライアントに露出する可能性！
}

// ✅ エラーをキャッチして安全なメッセージを返す
export async function deleteUser(id: string) {
  try {
    await prisma.user.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    // エラーをサーバーログに記録
    console.error("deleteUser error:", error);
    // クライアントには安全なメッセージを返す
    return { success: false, error: "ユーザーの削除に失敗しました" };
  }
}
```

```typescript
// ⚠️ 落とし穴3：認証チェックを忘れない
"use server";

// ❌ 認証なし（誰でも呼べる！）
export async function updateProfile(formData: FormData) {
  await db.user.update({ where: { id: formData.get("id") as string }, data: { ... } });
}

// ✅ 必ず認証チェック
export async function updateProfile(formData: FormData) {
  const session = await auth(); // セッション取得
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // セッションのユーザーIDを使用（フォームの id を信頼しない）
  await db.user.update({
    where: { id: session.user.id },
    data: { name: formData.get("name") as string },
  });
}
```

## 5. 移行チェックリスト

```
React 18 → 19 移行チェックリスト：

□ react と react-dom を 19.x にアップグレード
□ @types/react を 19.x にアップグレード
□ forwardRef の codemod を実行（オプション）
□ useFormState → useActionState のリネーム（react-dom → react）
□ useActionState の戻り値を3要素に更新（isPending を追加）
□ コンポーネントライブラリの React 19 対応版を確認
  - @mui/material
  - @radix-ui/*
  - react-hook-form（v7.51+ で対応）
  - framer-motion（v11+ で対応）
□ Server Actions のエラーハンドリングとセキュリティレビュー
□ PropTypes の削除（React 19 で完全廃止）
□ string refs の削除（React 19 で完全廃止）
```

## まとめ

React 19の移行は、`forwardRef`廃止と`useActionState`の名称変更が最も影響の大きい変更です。コミュニティライブラリの対応状況を事前に確認し、`codemod`を活用することで移行コストを下げられます。Server Actionsを使う場合はセキュリティとシリアライズ制約に特に注意してください。
