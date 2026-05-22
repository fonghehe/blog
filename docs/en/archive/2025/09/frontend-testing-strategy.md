---
title: "Frontend Testing Strategy: Practical Over Perfect"
date: 2025-09-08 15:22:59
tags:
  - Frontend
readingTime: 2
description: "Testing is something everyone knows is important, but most teams actually do poorly. Let me share how my thinking about frontend testing strategy has evolved ov"
wordCount: 196
---

Testing is something everyone knows is important, but most teams actually do poorly. Let me share how my thinking about frontend testing strategy has evolved over the past few years.

## Testing Pyramid → Testing Trophy

The classic testing pyramid says: most unit tests, medium integration tests, fewest E2E.

But Kent C. Dodds' Testing Trophy is better suited for frontend:

```
            /\
           /E2E\        Few (critical flows)
          /------\
         /Integration\  Middle (feature modules)
        /------------\
       /  Unit Tests  \  Some (pure functions, utilities)
      /----------------\
     /   Static Types   \  Most (TypeScript)
    /--------------------\
```

**The most important are integration tests**, because they best reflect real user experience while being faster than E2E.

## Tool Selection (2025)

```
Unit/Integration: Vitest (fast, native ESM, Vite ecosystem)
Component tests:  @testing-library/react or @testing-library/vue
E2E:             Playwright (more modern than Cypress)
Coverage:        @vitest/coverage-v8
```

## What to Test, What Not to Test

```
✅ Do test:
  - Business logic (can users complete a flow)
  - Edge cases (empty data, error states)
  - Pure functions and utilities
  - API integration (MSW mock)

❌ Don't bother testing:
  - Third-party library behavior
  - Implementation details (internal state, private methods)
  - Styles (unless visual regression testing)
  - Every simple getter/setter
```

## Actual Test Examples

```tsx
// Test user flows, not implementation details
import { render, screen, userEvent } from "@testing-library/react";
import { AddToCart } from "./AddToCart";

describe("AddToCart", () => {
  it("clicking add to cart increases count and shows success message", async () => {
    const user = userEvent.setup();
    const mockAddToCart = vi.fn().mockResolvedValue({ success: true });

    render(<AddToCart productId="123" onAddToCart={mockAddToCart} />);

    // Simulate user action
    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    // Verify result (not implementation details)
    expect(mockAddToCart).toHaveBeenCalledWith("123", 1);
    expect(await screen.findByText("Added to cart")).toBeInTheDocument();
  });

  it("button is disabled when out of stock", () => {
    render(<AddToCart productId="123" inStock={false} />);

    const button = screen.getByRole("button", { name: /add to cart/i });
    expect(button).toBeDisabled();
  });
});
```

```typescript
// MSW: mock API requests
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/products/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "Test Product",
      price: 99,
      inStock: true,
    });
  }),

  http.post("/api/cart", () => {
    return HttpResponse.json({ success: true, cartCount: 1 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Playwright E2E

```typescript
// tests/checkout.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Checkout flow", () => {
  test("user can complete the full purchase flow", async ({ page }) => {
    await page.goto("/products/123");

    await expect(page.getByRole("heading")).toContainText("Product Name");

    await page.getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/cart");
    await page.getByRole("button", { name: "Checkout" }).click();

    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="address"]', "123 Test St");

    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(page.getByText("Order placed successfully")).toBeVisible();
  });
});
```

## CI Integration

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    pnpm test:unit --coverage
    pnpm test:e2e

- name: Check coverage threshold
  run: |
    # Coverage below threshold → CI fails
    pnpm test:coverage --reporter=json
    node scripts/check-coverage.js 70  # 70% threshold
```

## Testing Culture

The technology isn't the hard part—the hard part is getting the team to treat testing as part of daily work:

- **Tests are part of the code, not extra work**
- Check tests during code review
- Write a failing test before fixing a bug, then fix the bug
- Don't chase 100% coverage, chase meaningful tests

## Summary

- Testing Trophy: integration > unit > E2E
- What to test: user flows, business logic, edge cases
- What not to test: implementation details, third-party libraries, simple styles
- Tools: Vitest + @testing-library + MSW + Playwright
- Coverage is a means, not an end; 70% meaningful coverage beats 95% fake numbers
