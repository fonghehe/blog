---
title: "TypeScript 5.4：NoIntrinsic、Object.groupBy と型推論強化"
date: 2024-02-06 10:05:36
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 5.4 が正式にリリースされ、実用的な型システムの改善と TC39 の新しい提案への対応がもたらされました。アーキテクチャの観点から、いくつかの機能はチームのコード品質向上に顕著な効果をもたらします。"
wordCount: 625
---

TypeScript 5.4 が正式にリリースされ、実用的な型システムの改善と TC39 の新しいプロポーザルへの対応がもたらされました。アーキテクチャの観点から見ると、いくつかの機能はチームのコード品質向上に顕著な効果があります。

## Object.groupBy と Map.groupBy

以前はグループ化操作に reduce を書く必要がありました：

```typescript
// 以前：手書きの reduce
const grouped = users.reduce((acc, user) => {
  const key = user.role;
  if (!acc[key]) acc[key] = [];
  acc[key].push(user);
  return acc;
}, {} as Record<string, User[]>);

// TypeScript 5.4 + ES2024
const grouped = Object.groupBy(users, (user) => user.role);
// grouped の型は Partial<Record<string, User[]>>
```

`Partial` を返すのは合理的です。グループ化の結果がすべての可能なキーを含むとは限らないからです。

`Map.groupBy` は `Map<K, V[]>` を返し、任意の型をキーとしてサポートします：

```typescript
const byDept = Map.groupBy(users, (u) => departments.get(u.deptId)!);
// Map<Department, User[]> を返す
```

## NoIntrinsic 型安全強化

TypeScript 5.4 で導入された `NoIntrinsic` 型は、テンプレートリテラル型の拡張です。HTML 属性マッピングをより正確に処理します：

```typescript
// 型推論がより正確に、条件型内の交差型の分配がより正確に
type ExtractId<T> = T extends `${infer Prefix}_${infer Suffix}`
  ? `${Prefix}_id`
  : never;

type Result = ExtractId<"user_name" | "post_title">;
// "user_id" | "post_id"
```

## クロージャの型絞り込みの改善

非常に実用的な改善：クロージャでキャプチャされた変数が正しく型の絞り込みを維持できるようになりました：

```typescript
function processValue(input: string | number) {
  if (typeof input === "string") {
    // TS 5.4 以前：クロージャ内の input が string 型を失う可能性があった
    const handler = () => {
      return input.toUpperCase(); // 現在は正しく string として認識される
    };
  }
}
```

## in 演算子による型絞り込みの強化

```typescript
interface Dog {
  bark(): void;
}

interface Cat {
  meow(): void;
}

function handlePet(pet: Dog | Cat) {
  if ("bark" in pet) {
    pet.bark(); // TS 5.4 以前はここで十分に正確ではなかった可能性がある
  }
}
```

## プロジェクトへの導入

私たちのチームが TS 5.4 にアップグレードする際、いくつかのシナリオに注目しました：

1. **データ処理層**：カスタム groupBy ユーティリティ関数をネイティブの `Object.groupBy` に置き換え、約200行の重複コードを削減
2. **型安全性**：改善された条件型推論を活用し、API レスポンス型の自動導出を簡略化
3. **チーム規範**：ESLint ルールを更新し、ネイティブ API を使用できる箇所を検出してマーク

## まとめ

- `Object.groupBy` / `Map.groupBy`：ネイティブのグループ化 API、重複ユーティリティ関数を削減
- クロージャの型絞り込み：クロージャでキャプチャされた変数が型情報を保持
- `in` 演算子の強化：より正確な型の絞り込み
- 条件型推論の改善：交差型の処理がより正確に
- チーム全体でのアップグレードを推奨、`target: "ES2024"` と組み合わせて使用
