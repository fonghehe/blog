---
title: "TypeScript Basics: Why You Should Start Learning It Now"
date: 2018-03-03 17:32:01
tags:
  - TypeScript
readingTime: 2
description: "TypeScript isn't new (Microsoft released it in 2012), but it only became truly popular in the Chinese frontend community in 2017–2018. Angular 2+ mandates it, a"
---

TypeScript isn't new (Microsoft released it in 2012), but it only became truly popular in the Chinese frontend community in 2017–2018. Angular 2+ mandates it, and Vue 2.5 improved TS support significantly — it's time to take it seriously.

## Why Use TypeScript

JavaScript's type issues are often only exposed at runtime:

```javascript
function add(a, b) {
  return a + b;
}

add(1, 2); // 3, correct
add("1", 2); // '12', string concatenation — probably a bug
add(null, 2); // 2, null treated as 0 — may be unexpected
```

TypeScript catches these issues at compile time:

```typescript
function add(a: number, b: number): number {
  return a + b;
}

add("1", 2); // ❌ Compile error: Argument of type 'string' is not assignable to parameter of type 'number'
```

## Basic Types

```typescript
// Primitive types
let name: string = "Alice";
let age: number = 25;
let isActive: boolean = true;

// Arrays
let nums: number[] = [1, 2, 3];
let strs: Array<string> = ["a", "b"];

// Tuples (fixed length and types)
let pair: [string, number] = ["Alice", 25];

// Enums
enum Direction {
  Up,
  Down,
  Left,
  Right,
}
let dir: Direction = Direction.Up; // value is 0

// any (escape hatch — use sparingly)
let anything: any = "hello";
anything = 42; // no error

// void (function with no return value)
function log(msg: string): void {
  console.log(msg);
}

// null and undefined
let n: null = null;
let u: undefined = undefined;
```

## Interfaces

Describe the shape of an object:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number; // optional property
  readonly token: string; // read-only property
}

function createUser(user: User): void {
  console.log(user.name);
  // user.token = 'new'  // ❌ read-only, cannot modify
}

createUser({
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  token: "abc123",
});
```

Interfaces can also describe functions:

```typescript
interface SearchFunc {
  (query: string, limit: number): Promise<string[]>;
}

const search: SearchFunc = async (query, limit) => {
  // implementation...
  return [];
};
```

## Type Aliases

```typescript
type ID = string | number;
type Status = "active" | "inactive" | "pending";

let userId: ID = 123;
userId = "user-456"; // also valid

let status: Status = "active";
status = "deleted"; // ❌ not in the union type
```

## Generics

Make functions/classes/interfaces work with multiple types:

```typescript
// Without generics: must use any, losing type safety
function first(arr: any[]): any {
  return arr[0];
}

// With generics: type-safe
function first<T>(arr: T[]): T {
  return arr[0];
}

const num = first([1, 2, 3]); // inferred type: num is number
const str = first(["a", "b"]); // str is string
```

## Using TypeScript in Vue 2.5+

### Option 1: vue-class-component (decorator style)

```typescript
{% raw %}
import Vue from "vue";
import Component from "vue-class-component";

@Component({
  template: '<button @click="onClick">{{ count }}</button>',
})
class Counter extends Vue {
  count: number = 0;

  onClick() {
    this.count++;
  }
}
{% endraw %}
```

### Option 2: Vue.extend (closer to the standard Options API)

```typescript
import Vue from "vue";

export default Vue.extend({
  data() {
    return {
      count: 0 as number,
      user: null as User | null,
    };
  },
  methods: {
    increment(): void {
      this.count++;
    },
    async fetchUser(id: number): Promise<void> {
      this.user = await api.getUser(id);
    },
  },
});
```

## Basic tsconfig.json Configuration

```json
{
  "compilerOptions": {
    "target": "es5", // compile to ES5
    "module": "commonjs",
    "strict": true, // enable all strict checks (recommended)
    "esModuleInterop": true, // allow import xxx from 'xxx' style
    "sourceMap": true, // generate source maps
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"] // path alias
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## Gradual Migration Strategy

You don't have to convert all JS to TS at once — migrate incrementally:

1. Enable `allowJs: true` in `tsconfig.json` so JS and TS files can coexist
2. Write new files in `.ts`
3. Gradually convert important old files to `.ts`
4. Finally set `allowJs: false`

## Summary

The core value of TypeScript is **catching type errors while writing code**, not at runtime. For medium-to-large projects, the payoff is significant. The learning curve is gentle — start with interfaces and basic types, and look up the docs as you go.
