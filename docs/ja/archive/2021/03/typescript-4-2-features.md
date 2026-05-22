---
title: "TypeScript 4.2 新機能"
date: 2021-03-22 17:22:02
tags:
  - TypeScript

readingTime: 3
description: "TypeScript 4.2 が2月末にリリースされ、実用的な型システムの改善がいくつかもたらされました。日常の開発に最も影響のある機能をいくつか紹介します。"
wordCount: 590
---

TypeScript 4.2 は 2 月末にリリースされ、実用的な型システムの改良がいくつかもたらされました。日常の開発に最も影響のある機能をいくつかご紹介します。

## Rest 元组类型中的命名元素

之前元组类型只能这样写：

```typescript
// 以前：位置でしか意味を理解できなかった
type Args = [string, number, boolean]
// ドキュメントを見ないと各位置の意味が全くわからない

function processArgs(...args: [string, number, boolean]) {
  const name = args[0]    // string
  const count = args[1]   // number
  const flag = args[2]    // boolean
}
```

4.2 ではタプル要素に名前を付けられます：

```typescript
// 4.2：タプル要素に名前を付けられる
type Args = [name: string, count: number, flag: boolean]

function processArgs(...args: [name: string, count: number, flag: boolean]) {
  const [name, count, flag] = args
  // IDE のヒントがより明確に
}
```

ライブラリ作成者にとって、API シグネチャの可読性向上は明らかです：

```typescript
// 実際のシナリオ：イベントハンドラのパラメータ
type EventHandler = [
  event: MouseEvent,
  data: { id: string; type: string },
  callback: (result: boolean) => void
]

// 分割代入時に名前が保持される
function handleMouseEvent(...[event, data, callback]: EventHandler) {
  console.log(event.clientX, data.id)
  callback(true)
}
```

## よりスマートな型エイリアスの展開

以前は特定の状況で TypeScript が型エイリアスを展開する際に中間の参照名を表示していましたが、現在は正しく最終型に展開されるようになりました：

```typescript
type ApiSuccess<T> = {
  code: 200
  data: T
  message: 'success'
}

type ApiError = {
  code: 400 | 500
  message: string
}

type ApiResponse<T> = ApiSuccess<T> | ApiError

// 以前 hover で表示されていた：ApiResponse<User>
// 4.2 hover で表示：ApiSuccess<User> | ApiError
// より明確に
```

## `abstract` コンストラクトシグネチャ

TypeScript 4.2 は `abstract` コンストラクトシグネチャをサポートし、型制約で抽象クラスでなければならないことを指定できます：

```typescript
abstract class Animal {
  abstract makeSound(): void
}

class Dog extends Animal {
  makeSound() { console.log('Woof') }
}

class Cat extends Animal {
  makeSound() { console.log('Meow') }
}

// 以前：型で abstract 制約ができなかった
function createAnimal(ctor: new () => Animal) {
  return new ctor()
}

// 4.2：abstract で制約可能
function createAnimal(ctor: abstract new () => Animal) {
  // これで Animal 自体は渡せなくなる（abstract だから）
  // Dog、Cat のような具象サブクラスのみ渡せる
  return new ctor()
}

// ❌ createAnimal(Animal) // Animal はインスタンス化不可
// ✅ createAnimal(Dog)    // OK
// ✅ createAnimal(Cat)    // OK
```

フレームワーク設計において、この機能は渡す具象実装クラスを強制するのに役立ちます：

```typescript
// DI コンテナのシナリオ
abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T>
  abstract save(entity: T): Promise<void>
}

class Container {
  private factories = new Map<string, abstract new () => BaseRepository<any>>()

  register<T>(key: string, ctor: abstract new () => BaseRepository<T>) {
    this.factories.set(key, ctor)
  }
}
```

## `--noPropertyAccessFromIndexSignature`

このコンパイラオプションは、TypeScript の長年の「緩すぎる」問題を解決します：

```typescript
interface Config {
  host: string
  port: number
  [key: string]: string | number
}

const config: Config = { host: 'localhost', port: 3000 }

// デフォルトの動作：両方のアクセス方法を許可
config.host        // string — OK
config['host']     // string — OK
config.timeout     // string | number — エラーなし、しかしタイプミスの可能性

// --noPropertyAccessFromIndexSignature を有効にした後
config.host        // ✅ OK，明示的に宣言されたプロパティ
config['host']     // ✅ OK，明示的にブラケットを使いインデックスシグネチャへのアクセスを理解していることを示す
config.timeout     // ❌ エラー！明示的に宣言されたプロパティではない
config['timeout']  // ✅ OK，ブラケットを使いインデックスシグネチャだと明確に示す
```

実際のプロジェクトではこのオプションは非常に有用です——スペルミスを発見できる一方で、インデックスシグネチャの柔軟性を失いません：

```typescript
// スペルミスがキャッチされる
config.hots // ❌ Error: Property 'hots' does not exist

// どうしても動的アクセスが必要な場合はブラケットを使う
config[dynamicKey] // ✅ OK
```

## 型推論の改善

4.2 では条件付き型での推論がより正確になりました：

```typescript
// より正確なタプル型推論
function tail<T extends any[]>(arr: readonly [any, ...T]): T {
  return arr.slice(1) as T
}

const result = tail([1, 'hello', true])
// [string, boolean] と推論され、(string | boolean)[] ではない
```

## まとめ

- タプル要素の名前付けは API シグネチャの可読性を高め、ライブラリ作成者にとって特に有益
- `abstract` コンストラクトシグネチャはフレームワークや DI のシナリオで実用的
- `--noPropertyAccessFromIndexSignature` は新規プロジェクトで有効にすることを推奨、スペルミスをキャッチできる
- TypeScript は毎バージョンで型システムをより正確にしており、追従する価値がある
