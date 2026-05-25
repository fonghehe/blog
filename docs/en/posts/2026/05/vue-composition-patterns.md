---
title: "Vue 2026 Composition Architecture: From Composables to Domain Module Governance"
date: 2026-05-25 16:22:09
tags:
  - Vue
  - Engineering
readingTime: 4
description: "After Vue 3, the Composition API became the default way to organize complex business logic. This article covers composable layering, state boundaries, module governance, and testability in 2026 Vue projects."
wordCount: 898
---

The complexity of a Vue project rarely starts with the number of components. It starts when business logic becomes scattered across pages, components, and stores. In 2026, Vue teams need a composition architecture that clarifies what belongs in a composable, what should stay local, and what deserves to become a domain module.

## Composables Are Not Universal Abstractions

A common mistake is extracting every bit of logic into `useXxx`. It looks reusable at first, but it can create hidden dependencies, lifecycle confusion, and hard-to-test code. A more durable model splits composables into three explicit layers:

**Layer 1: Infrastructure Composables**

This layer handles only stable technical concerns, with zero business coupling. Typical examples:

- `useRequest`: Encapsulates request cancellation, retry, caching, and race condition handling
- `useDebounce` / `useThrottle`: Input debouncing and throttling
- `useIntersectionObserver`: Element visibility observation
- `useEventListener`: Event binding with automatic cleanup
- `useMediaQuery`: Responsive breakpoint detection

Infrastructure composables are characterized by **high reusability, zero business coupling, and one-way dependencies**. They reference no business types or domain logic and can be ported directly between projects.

**Layer 2: Domain Composables**

This layer carries explicit domain rules—it's the structured expression of business logic. Typical examples:

- `useProductSearch`: Encapsulates query, filter, sort, and pagination logic for product search
- `useOrderFlow`: Encapsulates the order flow state machine (Cart → Address → Payment → Confirmation)
- `usePermission`: Encapsulates permission checking logic for the current user
- `useFormValidation`: Encapsulates validation rules for specific business forms

Domain composables feature **clear business boundaries, independent testability, and one-way dependencies pointing to the infrastructure layer**. They typically include business-specific type definitions and constants.

**Layer 3: Adapter Composables**

This layer translates business workflows into the state shape needed by a specific page or component. Typical examples:

- `useProductListPage`: Composes `useProductSearch` + `usePagination` + route parameters
- `useDashboardData`: Aggregates loading/error/data states from multiple data sources
- `useUserProfile`: Composes user info, permissions, and edit state

Adapters are characterized by **lifecycle-bound to specific pages, composing multiple domain composables, and exposing view-specific state**. They are rarely reused across pages.

The three layers maintain one-way dependency: Adapter → Domain → Infrastructure. This constraint keeps dependency direction traceable as the project scales.

## Design State Boundaries Early

Vue's reactivity system is flexible, but flexibility does not mean every state should be shared. The 2026 best practice organizes state into four scopes:

**L1: Component State**
For form inputs, dialog visibility, current tab, local loading states. Characterized by short lifecycle and clear dependency scope. Use `ref` or `reactive`—no external access needed or desired.

**L2: Shared Component State**
For state passed between parent-child or sibling components. Preferred approach: `defineProps` + `defineEmits`, followed by `provide/inject`. Avoid reaching for a global store immediately.

**L3: Module State**
For state shared across multiple pages within a single business module. The typical implementation creates a module-level composable using `ref` internally, exposed via `provide/inject` or module singleton. Only promote state to this level when multiple business entry points depend on the same source of truth.

**L4: Global State**
For cross-module shared state like user info, global config, and theme settings. Use Pinia stores, but strictly control the count—a healthy mid-to-large project typically has no more than 5 global stores.

Key principle: **Keep state at the lowest scope possible. Module-scope before global-scope.** Every promotion of state scope means more coupling and more complex testing.

## Side Effect Management: Effects Aren't Universal

Vue's `watch` and `watchEffect` are powerful tools, but easily misused. The 2026 mature practice:

- **watch for reactive synchronization**: When A changes, update B (e.g., re-fetch data when route params change)
- **watchEffect for debugging and simple sync**: Not suitable for complex business logic
- **Business side effects belong in composable methods**: Explicit invocation is easier to trace and test than implicit triggers

A practical heuristic: if a `watch` callback exceeds 10 lines, or contains async operations and conditional branches, consider refactoring it into an explicit composable method.

## Testing Strategy

The biggest engineering benefit of composition architecture is dramatically improved testability. The recommended test pyramid:

- **Unit tests (70%)**: Pure logic tests for domain composables. Since they're decoupled from component context, you can verify them with `@vue/test-utils` or by directly invoking the composable function. This is the highest-ROI testing.
- **Integration tests (20%)**: Verify behavior when multiple composables compose together, and their interaction with Pinia stores.
- **Component tests (10%)**: Cover only critical interaction paths—no need to test every component.

During code review, focus on four dimensions: **correct dependency direction (one-way), reasonable state ownership (four-layer model), explicit side-effect entry points, and clear composable inputs/outputs**.

## Migration Strategy: From Chaos to Order

If your Vue project has accumulated messy mixins, overused stores, and scattered business logic, don't try to refactor everything at once. A more pragmatic migration path:

1. **Extract the infrastructure layer first**: Pull pure technical utility functions into infrastructure composables—this is the lowest-risk step
2. **Organize the domain layer**: Each time you modify a business module, encapsulate related logic into domain composables
3. **Integrate the adapter layer last**: Use the adapter pattern in new pages; migrate old pages gradually
4. **Write tests at every stage**: Tests are the safety net for refactoring. Don't attempt large-scale abstraction without them.

## Summary

Vue's advantage in 2026 is not only concise syntax. It is the ability to split complex business behavior into stable, testable, evolvable composition units. The three-layer composable architecture (Infrastructure → Domain → Adapter) plus the four-level state model (Component → Shared → Module → Global) provides a clear governance framework for large Vue projects. The key: composables serve business boundaries, not become another global toolbox.
