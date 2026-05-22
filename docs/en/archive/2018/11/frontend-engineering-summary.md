---
title: "Frontend Engineering in Review: What I Learned in 2018"
date: 2018-11-29 15:54:00
tags:
  - Frontend
readingTime: 2
description: "I've been doing frontend work for exactly two years now, and this year is when I truly entered the world of \"engineering.\" This article is a chance to organize "
wordCount: 356
---

I've been doing frontend work for exactly two years now, and this year is when I truly entered the world of "engineering." This article is a chance to organize my thoughts and give myself an anchor for a year-end retrospective.

## The Shift from "Gets the Job Done" to "Engineered"

When I started, making the page work was enough. This year I realized that building products requires more than just making it work:

```
Before: Can this feature be built?
Now:    Is this feature maintainable? Testable? Easy to collaborate on?
```

In concrete terms:

**Code organization**: shifted from piling all logic into components to separating by concern (API layer, state management, utilities)

**Build tools**: went from "there's a webpack config in the project but I can't understand it" to being able to configure Tree Shaking, code splitting, and environment variables as needed

**Code quality**: introduced ESLint + Prettier — code style is now consistent across the team; started writing unit tests, with at least the core logic covered

## The Biggest Learnings This Year

### 1. Vue Reactivity System

After understanding how `Object.defineProperty` works, many "strange behaviors" now have explanations:

```javascript
// Why doesn't this trigger reactivity?
this.obj.newKey = "value"; // ❌

// Why does this work?
this.$set(this.obj, "newKey", "value"); // ✅
Vue.set(this.obj, "newKey", "value"); // ✅
```

### 2. Async JavaScript

```javascript
// The evolution: callbacks → Promise → async/await
// Now I understand why async/await is syntactic sugar over generators + Promises
// I also know the differences between Promise.all / .race / .allSettled

// This gives me more tools when handling concurrent requests
const [users, orders] = await Promise.all([api.getUsers(), api.getOrders()]);
```

### 3. Performance Optimization

```
Lighthouse became an everyday tool
Learned to read the Chrome DevTools Performance panel
Understood CRP (Critical Rendering Path)
Using transform/opacity for animations instead of left/top
```

### 4. TypeScript

```typescript
// Went from "I don't see the point" to "this is great"
// The biggest win wasn't type safety itself, but IDE intelligence
// During refactoring, TypeScript type errors helped me find many missed call sites
```

## Things I Haven't Mastered Yet

Honestly, some things are still at the "know about but not fluent in" stage:

- **Testing**: wrote some unit tests, but no integration or E2E tests in practice
- **CI/CD**: the project uses Jenkins, but I don't really understand the config — I still ask DevOps when things go wrong
- **Performance monitoring**: understand it in theory, but haven't set up a production monitoring system
- **Nginx configuration**: can edit it, but can't write it from scratch

## What I Want to Do in 2019

React: the team mainly uses Vue, but React's ecosystem is strong, and the Hooks proposal is fascinating

TypeScript advanced: currently only using the basics — want to go deeper on conditional types and mapped types

Node.js: build a complete BFF (Backend for Frontend) layer, not just scripts

## Summary

2018 was the year of transitioning from "skilled worker" to "engineer." Technology isn't just about knowing how to use things — it's about understanding the principles and knowing how to collaborate as a team.

Here's hoping the code I write in 2019 is even better quality.
