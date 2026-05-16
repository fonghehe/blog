---
title: "A Practical Guide to Jest Frontend Unit Testing"
date: 2019-06-19 10:41:50
tags:
  - Testing
readingTime: 1
description: "Unit testing is known to be valuable, but many frontend projects skip it due to the overhead of getting started. This article covers the complete setup workflow"
---

Unit testing is known to be valuable, but many frontend projects skip it due to the overhead of getting started. This article covers the complete setup workflow and practical testing examples, covering the scenarios you'll encounter in real projects.

## Installation and Configuration

```bash
npm install --save-dev jest babel-jest @babel/core @babel/preset-env
# For React projects, also install:
npm install --save-dev @babel/preset-react @testing-library/react @testing-library/jest-dom
```

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "setupFilesAfterFramework": ["@testing-library/jest-dom/extend-expect"],
    "collectCoverageFrom": ["src/**/*.{js,jsx}", "!src/index.js"]
  }
}
```

```javascript
// babel.config.js
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-react",
  ],
};
```

## Core Matchers

```javascript
// math.js — functions to be tested
export const sum = (a, b) => a + b;
export const subtract = (a, b) => a - b;
export const multiply = (a, b) => a * b;
export const divide = (a, b) => {
  if (b === 0) throw new Error("Cannot divide by zero");
  return a / b;
};
```

```javascript
// math.test.js
import { sum, subtract, multiply, divide } from "./math";

describe("Math utilities", () => {
  // Equality
  test("sum: 1 + 2 = 3", () => {
    expect(sum(1, 2)).toBe(3); // strictly equal (===)
    expect(sum(1, 2)).toEqual(3); // deep equality (objects/arrays)
  });

  // Truthiness
  test("subtract: result is truthy", () => {
    expect(subtract(5, 3)).toBeTruthy(); // truthy
    expect(subtract(3, 3)).toBeFalsy(); // falsy
    expect(subtract(5, 3)).toBeDefined(); // not undefined
  });

  // Numbers
  test("multiply: 2 * 3 = 6", () => {
    expect(multiply(2, 3)).toBe(6);
    expect(multiply(0.1, 0.2)).toBeCloseTo(0.02); // floating point comparison
  });

  // Exceptions
  test("divide: throws on division by zero", () => {
    expect(() => divide(10, 0)).toThrow("Cannot divide by zero");
    expect(() => divide(10, 0)).toThrow(Error);
  });

  // Arrays and objects
  test("results in arrays", () => {
    expect([1, 2, 3]).toContain(2);
    expect({ name: "Alice", age: 25 }).toMatchObject({ name: "Alice" });
  });
});
```

## Async Testing

```javascript
// Async function
test("async function test", async () => {
  const data = await fetchUser(1);
  expect(data.name).toBe("Alice");
});

// Mock async request
jest.mock("./api", () => ({
  fetchUser: jest.fn().mockResolvedValue({ id: 1, name: "Alice" }),
}));
```

Start with the most critical pure function logic — functions with no side effects are the easiest to test and provide the highest return on investment.
