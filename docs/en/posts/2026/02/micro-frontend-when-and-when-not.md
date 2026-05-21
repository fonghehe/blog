---
title: "Micro-Frontends: When to Split and When Not To"
date: 2026-02-12 10:00:00
tags:
  - Micro-frontend
readingTime: 2
description: "Over the past two years I've helped several teams evaluate micro-frontends — some moved forward, others pulled the plug. I want to write a clear-eyed article ab"
wordCount: 253
---

Over the past two years I've helped several teams evaluate micro-frontends — some moved forward, others pulled the plug. I want to write a clear-eyed article about it.

## What Are Micro-Frontends?

Simply put: splitting a large frontend application into multiple smaller apps that can be **independently developed and independently deployed**, then composed together at runtime.

```
Traditional monolithic frontend:
  One repo → one build → one deployment

Micro-frontends:
  Multiple repos → each builds independently → each deploys independently → composed at runtime
```

## When Micro-Frontends Make Sense

**Scenario 1: Multi-team collaboration with release conflicts**

```
Team A owns the order system, Team B owns the inventory system.
Both teams edit code in the same repo.
Release windows conflict; they constantly block each other.
→ Split into micro-frontends so each team deploys independently.
```

**Scenario 2: Gradual migration of a legacy system**

```
Old system is jQuery, new system is React.
A full rewrite is not feasible (too large, too risky).
→ Use micro-frontends: new entry points use React, legacy features stay in jQuery.
Gradually replace over time.
```

**Scenario 3: Technology stack diversity (sometimes)**

```
Different teams have different technology preferences.
→ This justification is dangerous and tends to accumulate tech debt.
It's only valid when different use cases genuinely require different tech.
```

## When Micro-Frontends Don't Make Sense

**Team size of 1–3 people**

The engineering overhead micro-frontends introduce — routing coordination, state sharing, build configuration — far outweighs the benefits.

**Product is early-stage with rapidly changing requirements**

Once you've split boundaries, cross-application changes during requirement shifts become painful. Wait until the business stabilizes.

**"Others are doing it, so should we"**

You've seen qiankun, single-spa, Module Federation and just want in, without a clear problem you're solving.

## The Real Cost of Micro-Frontends

```
1. Style isolation: Styles must not bleed between apps — requires a CSS scoping strategy.
2. Shared state: User login info, themes, etc. need to be shared across apps.
3. Routing coordination: How does the host app's routing interact with sub-app routing?
4. Build complexity: Each app needs its own CI/CD pipeline.
5. Local development friction: You need N apps running simultaneously to debug.
6. Performance: Shared dependencies may be loaded multiple times (React could load twice).
```

**The cost of solving shared dependency problems** tends to exceed expectations.

## Module Federation in Practice

If you've decided to go with micro-frontends, in 2025 I'd recommend Webpack 5 Module Federation or Vite's federation plugin:

```javascript
// host/vite.config.ts
import federation from "@originjs/vite-plugin-federation";

export default {
  plugins: [
    federation({
      name: "host",
      remotes: {
        // Load remote modules at runtime
        orderApp: "http://order.example.com/assets/remoteEntry.js",
        inventoryApp: "http://inventory.example.com/assets/remoteEntry.js",
      },
      shared: ["react", "react-dom"], // Share deps to avoid duplicate loading
    }),
  ],
};
```

```javascript
// order-app/vite.config.ts
import federation from "@originjs/vite-plugin-federation";

export default {
  plugins: [
    federation({
      name: "orderApp",
      filename: "remoteEntry.js",
      exposes: {
        "./OrderList": "./src/components/OrderList.tsx",
        "./OrderDetail": "./src/components/OrderDetail.tsx",
      },
      shared: ["react", "react-dom"],
    }),
  ],
};
```

```tsx
// Consuming a remote component in the host
import React, { lazy, Suspense } from "react";
const OrderList = lazy(() => import("orderApp/OrderList"));

function App() {
  return (
    <Suspense fallback={<div>Loading order module...</div>}>
      <OrderList />
    </Suspense>
  );
}
```

## My Decision Tree

```
Is there a genuine need for independent deployments?
  ├── No → Micro-frontends are not needed.
  └── Yes → How large is the team?
            ├── < 5 people → A monorepo with Nx may be a better fit.
            └── ≥ 5 people, multiple independent teams → Continue evaluation.
                                        ↓
                               Are business boundaries clear?
                               ├── No → Clarify the business first, then split the tech.
                               └── Yes → Micro-frontends are worth considering.
                                            ↓
                                  Has the split plan been evaluated in detail?
                                  (routing, state, styling, CI/CD costs)
                                  ├── No → Do the evaluation first.
                                  └── Yes, and it's acceptable → Proceed.
```

## Summary

- Micro-frontends are not a silver bullet — they trade engineering complexity for deployment independence.
- Suitable for: multi-team collaboration, legacy migration. Not suitable for: small teams, early-stage products.
- Before adopting micro-frontends, think through style isolation, state sharing, routing coordination, and CI/CD costs.
- Module Federation is currently the most mature approach.
- Don't split before your business boundaries are clear.
