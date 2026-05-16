---
title: "Getting Started with Jest Unit Testing"
date: 2018-04-02 10:27:58
tags:
  - Testing
readingTime: 2
description: "Frontend testing has long been a neglected area, but as projects grow, untested code becomes increasingly hard to maintain. Jest is the most popular JavaScript "
---

Frontend testing has long been a neglected area, but as projects grow, untested code becomes increasingly hard to maintain. Jest is the most popular JavaScript testing framework today — easy to configure and feature-complete.

## Installation and Configuration

```bash
npm install --save-dev jest babel-jest @babel/preset-env

# For Vue projects, also install:
npm install --save-dev @vue/test-utils vue-jest
```

```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ["js", "vue", "json"],
  transform: {
    "^.+\\.vue$": "vue-jest",
    "^.+\\.js$": "babel-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // path alias
  },
  testMatch: ["**/__tests__/**/*.spec.js"],
};
```

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Basic Syntax

```javascript
// __tests__/utils.spec.js

// describe groups tests
describe("formatPrice", () => {
  // it/test for a single test case
  it("formats integer prices correctly", () => {
    expect(formatPrice(1000)).toBe("1,000.00");
  });

  it("formats decimal prices correctly", () => {
    expect(formatPrice(1234.5)).toBe("1,234.50");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("0.00");
  });

  it("handles negative numbers", () => {
    expect(formatPrice(-100)).toBe("-100.00");
  });
});
```

## Common Matchers

```javascript
// Equality
expect(1 + 1).toBe(2); // strict equality ===
expect({ a: 1 }).toEqual({ a: 1 }); // deep equality

// Truthiness
expect(true).toBeTruthy();
expect(null).toBeFalsy();
expect(null).toBeNull();
expect(undefined).toBeUndefined();

// Numbers
expect(5).toBeGreaterThan(3);
expect(5).toBeLessThanOrEqual(5);

// Strings
expect("hello world").toContain("world");
expect("hello").toMatch(/^hel/);

// Arrays
expect([1, 2, 3]).toContain(2);
expect([1, 2, 3]).toHaveLength(3);

// Objects
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }); // subset match is enough

// Exceptions
expect(() => {
  throw new Error("oops");
}).toThrow("oops");
```

## Testing Async Code

```javascript
// async/await (recommended)
it("fetchUser returns the correct data", async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe("Alice");
});

// Promise style
it("fetchUser returns the correct data", () => {
  return fetchUser(1).then((user) => {
    expect(user.name).toBe("Alice");
  });
});
```

## Mock Functions

```javascript
// jest.fn() creates a mock function
const mockFn = jest.fn();
mockFn.mockReturnValue(42); // set return value
mockFn.mockResolvedValue({ id: 1, name: "Alice" }); // set Promise return value

// Verify after calling
mockFn("arg1", "arg2");
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(1);
```

## Mocking Modules

```javascript
// Mock axios requests
jest.mock("axios");
import axios from "axios";

it("calls the API to fetch user data", async () => {
  axios.get.mockResolvedValue({ data: { id: 1, name: "Alice" } });

  const user = await getUser(1);

  expect(axios.get).toHaveBeenCalledWith("/api/users/1");
  expect(user.name).toBe("Alice");
});
```

## Vue Component Testing

```javascript
// __tests__/Button.spec.js
import { mount } from "@vue/test-utils";
import Button from "@/components/Button.vue";

describe("Button component", () => {
  it("renders default slot content", () => {
    const wrapper = mount(Button, {
      slots: { default: "Click me" },
    });
    expect(wrapper.text()).toContain("Click me");
  });

  it("emits click event when clicked", async () => {
    const wrapper = mount(Button);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("does not emit event when disabled", async () => {
    const wrapper = mount(Button, {
      propsData: { disabled: true },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();
  });

  it("shows loading state when loading prop is set", () => {
    const wrapper = mount(Button, {
      propsData: { loading: true },
    });
    expect(wrapper.find(".loading-icon").exists()).toBe(true);
  });
});
```

## Test Coverage

```bash
npm run test:coverage
```

The report focuses on several metrics:

- **Statements**: statement coverage
- **Branches**: branch coverage (did both if/else paths execute?)
- **Functions**: function coverage
- **Lines**: line coverage

Don't chase 100%. Focus on utility functions and core business logic; UI presentation components can have less coverage.

## Summary

- Start with pure functions — the lowest barrier to entry
- `expect().toBe()` for basics; `toEqual()` for objects
- Use `async/await` for async tests
- Use `@vue/test-utils` for component tests to test interactive behavior
- With tests in place, refactoring code becomes much more confident
