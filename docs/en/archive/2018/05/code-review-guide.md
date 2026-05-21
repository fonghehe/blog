---
title: "Frontend Code Review Guide"
date: 2018-05-22 11:15:39
tags:
  - Frontend
readingTime: 2
description: "Code Review is one of the most effective ways to raise a team's code quality. But many teams either skip it entirely or go through the motions. This article sha"
wordCount: 360
---

Code Review is one of the most effective ways to raise a team's code quality. But many teams either skip it entirely or go through the motions. This article shares our team's hands-on experience.

## Why Code Review Is Worth the Investment

- Catching bugs: 10× cheaper than catching them in testing
- Spreading knowledge: new joiners quickly learn team best practices
- Enforcing consistency: less "personal style" code
- Architectural oversight: catch design problems before code is merged
- Reducing silos: avoid situations where only one person understands a codebase area

## PR Standards

A good PR makes the reviewer's life easy; a bad PR leaves them not knowing where to start.

**PR size**: no more than 400 changed lines per PR (excluding auto-generated files). Split large features into multiple PRs.

**PR description template**:

```markdown
## What was done

Users can now upload an avatar in their profile settings.

## Changes

- Added `AvatarUpload` component with cropping support
- Added `updateAvatar` action to `userStore`
- Upload limits: 5 MB, jpg/png/gif supported

## Testing

- [x] Normal upload flow
- [x] File too large warning
- [x] Unsupported file type warning
- [x] Upload failure retry

## Screenshots

[Avatar upload screenshot]
```

## What Reviewers Should Focus On

### Must Check

**Correctness**

```javascript
// ❌ Logic error: should use || not &&
if (!isAdmin && !hasPermission) {
  // Intended: allow if user is admin OR has permission
}

// ✅ Fixed
if (!isAdmin && !hasPermission) {  // deny only if neither condition is met
```

**Security**

```javascript
// ❌ Directly inserting user input into HTML
element.innerHTML = userInput;

// ❌ Writing sensitive info to logs
console.log("Token:", userToken);
```

**Edge cases**

```javascript
// ❌ Not handling an empty array
const firstItem = list[0].name; // crashes when list is empty

// ✅
const firstItem = list[0]?.name || "Unknown";
```

### Important Areas

**Maintainability**: is the function too long? Is the logic too convoluted? Are variable names clear?

```javascript
// ❌ Hard to understand
function p(d, t) {
  return d.filter((i) => i.s === t).map((i) => i.v);
}

// ✅ Clear
function filterValuesByStatus(data, targetStatus) {
  return data
    .filter((item) => item.status === targetStatus)
    .map((item) => item.value);
}
```

**Duplicated code**: does the same logic appear multiple times? Should it be extracted?

**Performance issues**:

```javascript
// ❌ Expensive computation inside a render loop
// In a Vue template:
<li v-for="item in list" :class="{ active: expensiveCompute(item) }">

// ✅ Pre-compute
computed: {
  processedList() {
    return this.list.map(item => ({
      ...item,
      isActive: this.expensiveCompute(item)
    }))
  }
}
```

### What You Don't Need to Enforce

- Code style (ESLint handles it)
- Minor naming preferences (as long as readability isn't hurt)
- Implementation approach (as long as it's correct and maintainable)

## Giving Good Feedback

**Unhelpful review comments**:

```
This code is terrible, rewrite it.
This function is too long.
```

**Helpful review comments**:

```
The for loop here can be simplified with Array.reduce,
and the current implementation is O(n²) — this will be a performance
issue with large datasets. Reference: [link]

Consider extracting this into a standalone function like calculateTotalPrice(items).
It can then be reused elsewhere and is easier to unit test.

Optional suggestion: add a boundary check here — if list is empty,
return [] directly to avoid downstream errors. (Not required)
```

## Review Cadence

- Don't review more than 500 lines at once
- Schedule dedicated time for complex PRs — don't review them in fragments
- After leaving comments, wait for the author to address them; don't keep finding new issues (aim to catch everything in the first pass)
- A PR is a collaboration tool, not an assignment — avoid authoritative-style reviews

## Don't Debate Architecture in PRs

If you find architectural-level issues, **discuss first, don't just block the PR**:

1. Mark as `needs discussion`, then have a conversation offline or in an issue
2. For small projects with minimal impact, merge first and refactor later
3. If a change is genuinely needed, offer concrete suggestions rather than saying "rewrite"

## Summary

- Keep PRs small and focused, with a clear description
- Reviews should focus on correctness, security, and maintainability
- Feedback should be specific and constructive — distinguish "must fix" from "suggestion"
- Code Review is collaboration, not judgment
