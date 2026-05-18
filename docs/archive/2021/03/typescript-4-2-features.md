---
title: "TypeScript 4.2 新特性"
date: 2021-03-22 17:22:02
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.2 在 2 月底发布，带来了一些实用的类型系统改进。挑几个对日常开发影响最大的特性说说。"
---

TypeScript 4.2 在 2 月底发布，带来了一些实用的类型系统改进。挑几个对日常开发影响最大的特性说说。

## Rest 元组类型中的命名元素

之前元组类型只能这样写：

```typescript
// 以前：只能用位置来理解含义
type Args = [string, number, boolean]
// 不看文档完全不知道每个位置是什么

function processArgs(...args: [string, number, boolean]) {
  const name = args[0]    // string
  const count = args[1]   // number
  const flag = args[2]    // boolean
}
```

4.2 支持给元组元素命名：

```typescript
// 4.2：元组元素可以命名
type Args = [name: string, count: number, flag: boolean]

function processArgs(...args: [name: string, count: number, flag: boolean]) {
  const [name, count, flag] = args
  // IDE 提示更清晰
}
```

对于库作者来说，API 签名的可读性提升很明显：

```typescript
// 实际场景：事件处理函数的参数
type EventHandler = [
  event: MouseEvent,
  data: { id: string; type: string },
  callback: (result: boolean) => void
]

// 解构时名称保留
function handleMouseEvent(...[event, data, callback]: EventHandler) {
  console.log(event.clientX, data.id)
  callback(true)
}
```

## 更智能的类型别名展开

以前某些情况下 TypeScript 展开类型别名时会显示中间的引用名称，现在能正确展开为最终类型了：

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

// 以前 hover 可能显示：ApiResponse<User>
// 4.2 hover 显示：ApiSuccess<User> | ApiError
// 更清晰
```

## `abstract` 构造签名

TypeScript 4.2 支持 `abstract` 构造签名，可以在类型约束中指定必须是抽象类：

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

// 以前：无法在类型中约束为 abstract
function createAnimal(ctor: new () => Animal) {
  return new ctor()
}

// 4.2：可以用 abstract 约束
function createAnimal(ctor: abstract new () => Animal) {
  // 这样就不能传 Animal 本身了（它是 abstract 的）
  // 只能传 Dog、Cat 这样的具体子类
  return new ctor()
}

// ❌ createAnimal(Animal) // Animal 不能实例化
// ✅ createAnimal(Dog)    // OK
// ✅ createAnimal(Cat)    // OK
```

在框架设计中，这个特性可以帮助强制要求传入的具体实现类：

```typescript
// DI 容器的场景
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

这个编译选项解决了 TypeScript 一个长期的"太宽松"问题：

```typescript
interface Config {
  host: string
  port: number
  [key: string]: string | number
}

const config: Config = { host: 'localhost', port: 3000 }

// 默认行为：两种访问方式都允许
config.host        // string — OK
config['host']     // string — OK
config.timeout     // string | number — 无报错，但可能是笔误

// 开启 --noPropertyAccessFromIndexSignature 后
config.host        // ✅ OK，显式声明的属性
config['host']     // ✅ OK，显式用方括号表示你清楚在访问索引签名
config.timeout     // ❌ 报错！不是显式声明的属性
config['timeout']  // ✅ OK，用方括号明确表示你知道这是索引签名
```

实际项目中这个选项非常有用——能发现拼写错误，同时不丧失索引签名的灵活性：

```typescript
// 拼写错误会被捕获
config.hots // ❌ Error: Property 'hots' does not exist

// 如果确实需要动态访问，用方括号
config[dynamicKey] // ✅ OK
```

## 类型推断的改进

4.2 在条件类型中的推断更准确了：

```typescript
// 更精确的元组类型推断
function tail<T extends any[]>(arr: readonly [any, ...T]): T {
  return arr.slice(1) as T
}

const result = tail([1, 'hello', true])
// 推断为 [string, boolean]，而不是 (string | boolean)[]
```

## 小结

- 元组元素命名让 API 签名更可读，库作者尤其受益
- `abstract` 构造签名在框架和 DI 场景中有实际用途
- `--noPropertyAccessFromIndexSignature` 建议在新项目中开启，能捕获拼写错误
- TypeScript 每个版本都在让类型系统更精确，保持跟进是值得的