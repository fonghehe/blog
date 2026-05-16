---
title: "Frontend Testing Strategy: From Unit Tests to E2E Tests"
date: 2019-03-22 09:33:00
tags:
  - Testing
readingTime: 1
description: "I've always known testing matters, but few projects actually write tests. After thoroughly researching the topic, I've put together a practical frontend testing"
---

I've always known testing matters, but few projects actually write tests. After thoroughly researching the topic, I've put together a practical frontend testing strategy.

## The Testing Pyramid

```
         /\
        /E2E\        Few: end-to-end tests (Cypress)
       /------\
      /Integration\  Some: component integration tests
     /------------\
    /  Unit Tests  \  Many: pure functions, utility function tests
   /______________\
```

Not all code needs to be tested — balance testing cost against value.

## Unit Testing: Jest

```bash
npm i -D jest @types/jest babel-jest
```

```javascript
// utils/price.js
export function formatPrice(price, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price);
}

export function calculateDiscount(original, discount) {
  if (discount < 0 || discount > 1)
    throw new Error("Discount must be between 0 and 1");
  return Math.round(original * discount * 100) / 100;
}
```

```javascript
// utils/price.test.js
import { formatPrice, calculateDiscount } from "./price";

describe("formatPrice", () => {
  it("formats USD price", () => {
    expect(formatPrice(1234.5)).toBe("$1,234.50");
  });

  it("formats price in other currencies", () => {
    expect(formatPrice(99.99, "JPY")).toBe("¥100");
  });
});

describe("calculateDiscount", () => {
  it("calculates 80% discount", () => {
    expect(calculateDiscount(100, 0.8)).toBe(80);
  });

  it("throws an error when discount is out of range", () => {
    expect(() => calculateDiscount(100, 1.5)).toThrow(
      "Discount must be between 0 and 1",
    );
    expect(() => calculateDiscount(100, -0.1)).toThrow();
  });

  it("handles floating point precision", () => {
    expect(calculateDiscount(99.99, 0.7)).toBe(69.99);
  });
});
```

## Vue Component Testing: Vue Test Utils

```bash
npm i -D @vue/test-utils vue-jest
```

```javascript
// components/BaseButton.test.js
import { shallowMount } from "@vue/test-utils";
import BaseButton from "./BaseButton.vue";

describe("BaseButton", () => {
  it("renders slot content", () => {
    const wrapper = shallowMount(BaseButton, {
      slots: { default: "Click me" },
    });
    expect(wrapper.text()).toBe("Click me");
  });

  it("emits click event when clicked", async () => {
    const wrapper = shallowMount(BaseButton);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("does not emit event when disabled", async () => {
```
