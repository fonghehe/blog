---
title: "2018 Year-End Review: A Year of Building Engineering Infrastructure"
date: 2018-12-26 16:13:36
tags:
  - Frontend
readingTime: 6
description: "Looking back at 2018, if I had to sum it up in one word, I'd choose \"systematization.\" At the start of the year I was still reinventing the wheel across project"
---

Looking back at 2018, if I had to sum it up in one word, I'd choose "systematization." At the start of the year I was still reinventing the wheel across projects. By year-end I had a reusable engineering system: a unified build pipeline, a cross-project component library, and team-level code quality standards. A good chunk of technical debt has been paid off, and the groundwork is mostly laid. Time for a retrospective.

## I. Technical Milestones of the Year

### TypeScript Fully Adopted

Early in the year I decided to introduce TypeScript to our main back-office projects. There was considerable pushback from the team — "What's the point of writing all those types?" was the most common complaint.

My strategy was incremental: start with new modules, then gradually refactor existing code. Two months in, a refactor changed an API signature and the editor immediately highlighted every affected call site. The team's attitude shifted from skepticism to dependency. By year-end, TypeScript coverage exceeded 70%, with complete coverage for core business modules.

### Webpack 4 Migration

Upgrading from Webpack 3 to 4 was more than just changing config. Average build time dropped from 120 seconds to 40 seconds. Using `splitChunks` for smart code-splitting compressed the initial JS payload from 680 KB to 420 KB. We also built a unified build-config package called `build-scripts`; new project setup time dropped from half a day to thirty minutes.

### Deeper Vue Understanding and React Exploration

On the Vue side, I dug deep into reactivity internals and component design patterns, and I led the internal component library from design to publication. I also started learning React systematically — not to replace Vue, but to make technology selection more rational. At year-end, a data-visualization project called for a React + D3 approach that turned out smoother than Vue, validating the real-world value of knowing both frameworks.

### Node.js BFF Layer

Toward year-end I started building a BFF (Backend for Frontend) middleware layer in Koa for API aggregation and data transformation. Although it's not yet in production, the full chain is working, and the feasibility of decoupling frontend from backend with a dedicated data layer is proven.

## II. Engineering Achievements

### Component Library

Led the completion of `@company/ui`, covering 40+ business-level components including tables, forms, filters, and chart containers. The design philosophy was "encapsulate business patterns, not just UI" — for example, `<SmartTable>` encapsulates full sort/filter/pagination interactions; business code only needs to configure column definitions and a data source.

Five active projects have adopted it, with a 60% component reuse rate. New-project UI development effort has dropped by an average of 40%.

### Build Optimization Metrics

| Metric            | Start of Year | End of Year | Improvement |
| ----------------- | ------------- | ----------- | ----------- |
| Build time        | ~120s         | ~40s        | 66%         |
| Initial JS size   | 680 KB        | 420 KB      | 38%         |
| New project setup | ~4h           | ~30min      | 87%         |

These numbers are the combined result of `HappyPack` multi-threaded builds, `SplitChunks` code-splitting, tree-shaking, and `ModuleConcatenationPlugin` (scope hoisting).

### Code Quality Toolchain

Adopted ESLint + Prettier for unified code style, paired with `husky` + `lint-staged` for pre-commit checks. Style debates among the team dropped to nearly zero — rules live in config, not in code review arguments.

## III. Code Quality Evolution

The shift in type-system usage and error handling best illustrates growing maturity. Using a typical API call as an example:

```typescript
// Early-year style: works, but fragile
async function handleSubmit() {
  this.loading = true;
  const res = await axios.post("/api/order", this.form);
  if (res.data.code === 0) {
    this.$message.success("Submitted successfully");
    this.$router.push("/orders");
  }
  this.loading = false;
}

// Late-year style: type-constrained, categorized errors, boundary protection
interface OrderForm {
  productId: string;
  quantity: number;
  remark?: string;
}

async function handleSubmit(): Promise<void> {
  this.submitting = true;
  try {
    const order = await orderApi.create<Order>(this.form);
    this.$message.success(`Order ${order.id} created`);
    this.$router.push({ name: "OrderDetail", params: { id: order.id } });
  } catch (e) {
    if (e instanceof ApiError) {
      switch (e.code) {
        case "STOCK_INSUFFICIENT":
          this.stockError = true;
          break;
        case "ORDER_LIMIT_EXCEEDED":
          this.$message.warning("Order limit reached");
          break;
        default:
          this.$message.error(e.message);
      }
    } else {
      throw e; // Non-business errors go to the global error handler
    }
  } finally {
    this.submitting = false;
  }
}
```

The core change isn't just "added types." It's: API calls have return-type constraints, errors have classified handling, unexpected errors aren't swallowed, and `finally` ensures consistent state. The mental model shifted from "make it run" to "make it readable and changeable three months from now."

## IV. Team Collaboration Experience

### Code Review Culture

Mid-year I pushed for team-wide code reviews. Initial resistance was high. The turning point was the first review that caught an N+1 request performance issue — the frontend triggered 50 parallel requests on every modal open. After the fix, modal load time dropped from 3 seconds to 0.5 seconds. Hard data speaks louder than lectures.

By year-end, code review was a team habit and PRs required at least one reviewer before merging. More importantly, review content shifted from "missing semicolons" to "is this abstraction right?" and "is there a better approach to this state management?"

### Knowledge Sharing

Gave 4 internal tech talks: TypeScript in Practice, Webpack Optimization, Component Library Design, Vue Performance Optimization. Each talk forced me to systematize knowledge. I also started encouraging others on the team to give talks, cultivating a "teaching forces learning" culture.

## V. Unfinished Items

**Test coverage** is still low. I wrote unit tests for some core logic, but it's far from routine. Component library tests are fairly complete; business code has almost none. This isn't laziness — it's a prioritization call. This year I tackled "zero-to-one" engineering infrastructure; testing is "one-to-ten" quality assurance, scheduled for 2019.

**CI/CD pipeline** is still maintained by the ops team. My understanding of Jenkins is stuck at "can change config and make it run." I haven't systematically grasped automated deployment, environment management, and release rollback. This is a capability an architect must develop.

**Documentation** is incomplete. The component library has READMEs but no full usage docs or API references, and design decisions aren't recorded. Onboarding a new hire made the importance of docs painfully clear — a lot of "why we did it this way" only lives in the heads of the original authors.

I don't view these as failures; they clarify the distance between "building an engineering system" and "having a mature engineering system." The 2019 goal is to close that gap.

## VI. 2019 Roadmap

### Technical Depth

- **Systematized testing**: Full unit-test coverage for the component library; 60%+ test coverage target for business code. Explore E2E testing (Cypress or Puppeteer).
- **Own the CI/CD**: Build a frontend-specific CI/CD pipeline with full lint → test → build → deploy automation.
- **Deeper React**: Not just surface-level usage — dig into hooks source code and Fiber architecture. Start a new project in React from scratch.
- **Monitoring and alerting**: Build a frontend monitoring system covering error capture, performance metrics, and user behavior tracking. Design from scratch, not just slapping on a third-party SDK.

### Architecture

- **Micro-frontend research**: Evaluate micro-frontend solutions (qiankun / Module Federation) as project count grows and deployment/maintenance costs rise.
- **BFF in production**: Polish the Koa BFF prototype to production readiness; truly decouple the frontend data layer.
- **Component library docs**: Build a component documentation site (Storybook-style) with full API docs and interactive examples.

### Team Building

- Codify Code Review standards into the team wiki for automatic onboarding.
- Establish a "weekly tech share" mechanism that covers all team members.
- Start cultivating 1–2 colleagues who can independently own technical directions.

## Summary

- TypeScript fully adopted; 70%+ project coverage; significant improvements in refactoring efficiency and code reliability
- Webpack 4 migration complete; build speed improved 66%; initial bundle size reduced 38%
- Led component library: 40+ business components, 5 projects adopted, 40% reduction in new-project UI effort
- Pushed Code Review culture from formality to substantive technical discussion
- Test coverage, CI/CD, and documentation are must-close gaps for next year
- 2019 core directions: quality assurance systematization + architecture capability expansion + team knowledge transfer
