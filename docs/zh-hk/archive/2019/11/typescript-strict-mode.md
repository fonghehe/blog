---
title: "TypeScript strict 模式最佳實踐：落地路徑與實戰建議"
date: 2019-11-20 09:57:07
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 的 `strict` 模式啓用了一系列嚴格的類型檢查選項，能在編譯期捕獲大量潛在錯誤。對於已有項目來説，啓用 strict 模式可能會帶來大量報錯。本文將詳細介紹 strict 模式的各個選項，以及如何漸進式地在項目中啓用嚴格類型檢查。"
wordCount: 472
---

TypeScript 的 `strict` 模式啓用了一系列嚴格的類型檢查選項，能在編譯期捕獲大量潛在錯誤。對於已有項目來説，啓用 strict 模式可能會帶來大量報錯。本文將詳細介紹 strict 模式的各個選項，以及如何漸進式地在項目中啓用嚴格類型檢查。

## strict 模式包含什麼

`strict: true` 實際上等同於開啓以下所有選項：

```json
{
  "compilerOptions": {
    "strict": true,
    // 等價於同時開啓：
    // "noImplicitAny": true,
    // "strictNullChecks": true,
    // "strictFunctionTypes": true,
    // "strictBindCallApply": true,
    // "strictPropertyInitialization": true,
    // "noImplicitThis": true,
    // "alwaysStrict": true
  }
}
```

## noImplicitAny

禁止隱式的 `any` 類型。所有變量、參數都必須有明確的類型：

```ts
// 關閉時（寬鬆模式）：參數隱式為 any
function add(a, b) {
  return a + b;
}

// 開啓後：必須顯式標註類型
function add(a: number, b: number): number {
  return a + b;
}

// 或者用類型推斷（參數還是需要標註）
const multiply = (a: number, b: number) => a * b;
```

常見報錯與解決：

```ts
// 報錯：Parameter 'event' implicitly has an 'any' type
// document.addEventListener('click', (event) => {
//   console.log(event.clientX);
// });

// 解決：標註正確的事件類型
document.addEventListener('click', (event: MouseEvent) => {
  console.log(event.clientX);
});

// 報錯：Binding element 'name' implicitly has an 'any' type
// function greet({ name }) {
//   return `Hello, ${name}`;
// }

// 解決：標註解構參數的類型
function greet({ name }: { name: string }) {
  return `Hello, ${name}`;
}

// 或者使用 interface
interface User {
  name: string;
  age?: number;
}

function greet(user: User) {
  return `Hello, ${user.name}`;
}
```

## strictNullChecks

`null` 和 `undefined` 不再是所有類型的子類型，必須顯式處理：

```ts
// 關閉時：可以忽略 null
const name: string = null; // 不報錯

// 開啓後：null 不能賦值給 string
const name: string | null = null; // 必須顯式聲明

// 常見場景
function getLength(str: string | undefined): number {
  // 報錯：Object is possibly 'undefined'
  // return str.length;

  // 解決1：類型守衞
  if (str === undefined) return 0;
  return str.length;

  // 解決2：可選鏈（TypeScript 3.7+）
  // return str?.length ?? 0;

  // 解決3：非空斷言（確定不為 null 時使用）
  // return str!.length;
}
```

在實際項目中的應用：

```ts
interface User {
  id: number;
  name: string;
  email: string | null;     // 可能沒有郵箱
  avatar?: string;          // 可選屬性
}

function displayUser(user: User | null) {
  // 必須檢查 null
  if (!user) {
    return '<p>未登錄</p>';
  }

  // 必須處理可能為 null 的屬性
  const emailDisplay = user.email ?? '未綁定郵箱';
  const avatarUrl = user.avatar ?? '/default-avatar.png';

  return `
    <img src="${avatarUrl}" alt="${user.name}" />
    <p>${user.name}</p>
    <p>${emailDisplay}</p>
  `;
}

// 使用數組方法時
function findUser(id: number): User | undefined {
  return users.find(u => u.id === id);
}

const user = findUser(1);
// user 可能是 undefined
if (user) {
  console.log(user.name); // 安全
}

// Array.find 返回 T | undefined
const firstUser = users[0]; // 報錯：可能越界
const firstUserSafe = users[0]; // 需要檢查
```

## strictFunctionTypes

函數參數類型檢查更嚴格，使用逆變（contravariance）檢查：

```ts
// 關閉時：參數類型是雙向協變的
type Handler = (event: Event) => void;
type MouseHandler = (event: MouseEvent) => void;

const mouseHandler: MouseHandler = (e) => console.log(e.clientX);
const handler: Handler = mouseHandler; // 不報錯

// 開啓後：參數類型是逆變的
// MouseHandler 的參數比 Handler 更具體
// 不能將 MouseHandler 賦值給 Handler
// 因為 Handler 可能被調用時傳入非 MouseEvent 的 Event
```

## strictPropertyInitialization

類屬性必須在構造函數中初始化，或有默認值：

```ts
class User {
  // 報錯：Property 'name' has no initializer
  // name: string;

  // 解決1：在構造函數中初始化
  name: string;
  constructor(name: string) {
    this.name = name;
  }

  // 解決2：使用默認值
  role: string = 'user';

  // 解決3：使用 ! 斷言（確定會在其他地方初始化）
  avatar!: string;

  // 解決4：可選屬性
  nickname?: string;
}
```

## 漸進式啓用 strict

對於已有項目，不建議一步到位啓用所有 strict 選項。可以漸進式遷移：

### 第一步：啓用 noImplicitAny

```json
{
  "compilerOptions": {
    "noImplicitAny": true
  }
}
```

處理策略：對確實不知道類型的參數，暫時使用 `any` 或 `unknown`：

```ts
// 對第三方庫的回調
function handleResponse(data: any) {
  // 逐步添加類型
}

// 使用 unknown 更安全（需要類型守衞）
function handleResponseSafe(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // 可以安全訪問
  }
}
```

### 第二步：啓用 strictNullChecks

這是最難的一步，因為現有代碼很少處理 null：

```json
{
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

使用 `// @ts-ignore` 或 `as any` 臨時繞過，逐步修復：

```ts
// 臨時繞過
// @ts-ignore
const name: string = userData.name;

// 逐步修復
const name: string = userData?.name ?? 'unknown';
```

### 第三步：啓用其餘選項

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## 使用 unknown 替代 any

`unknown` 是類型安全的 `any`：

```ts
// any：關閉類型檢查
function processAny(data: any) {
  data.foo.bar; // 不報錯，但運行時可能出錯
}

// unknown：強製類型檢查
function processUnknown(data: unknown) {
  // data.foo.bar; // 報錯：'data' is of type 'unknown'

  // 必須先檢查類型
  if (typeof data === 'object' && data !== null && 'foo' in data) {
    const obj = data as { foo: { bar: string } };
    obj.foo.bar; // 安全
  }
}

// 實際場景：API 響應處理
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();

  // 類型守衞驗證
  if (!isValidUser(data)) {
    throw new Error('Invalid user data');
  }

  return data;
}

function isValidUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data
  );
}
```

## 常用類型守衞

```ts
// typeof 類型守衞
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// instanceof 類型守衞
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// 自定義類型守衞
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'data' in value
  );
}
```

## 小結

- `strict: true` 包含 7 個嚴格類型檢查選項
- `noImplicitAny` 禁止隱式 any，`strictNullChecks` 強製處理 null/undefined
- 建議漸進式啓用：先 noImplicitAny，再 strictNullChecks，最後全部開啓
- 使用 `unknown` 替代 `any`，提高類型安全性
- 類型守衞（type guard）是處理聯合類型的關鍵工具
- 臨時使用 `// @ts-ignore` 繞過報錯，逐步修復
- strict 模式雖然前期投入大，但能顯著減少運行時錯誤
