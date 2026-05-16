---
title: "ES2018 Key New Features at a Glance"
date: 2018-06-02 16:13:59
tags:
  - Frontend
readingTime: 1
description: "ES2018 is now finalized. Here's a summary of the most useful new features."
---

ES2018 is now finalized. Here's a summary of the most useful new features.

## Promise.finally

Runs regardless of whether the Promise resolves or rejects:

```javascript
fetch("/api/data")
  .then((res) => res.json())
  .catch((err) => console.error(err))
  .finally(() => {
    this.loading = false; // close loading whether success or failure
  });
```

Much more elegant than writing `loading = false` in both `then` and `catch`.

## Object Rest/Spread (Finally Here)

```javascript
// spread: copy and override properties
const user = { name: "Alice", age: 25, role: "admin" };
const updated = { ...user, age: 26 };

// rest: extract remaining properties
const { role, ...userWithoutRole } = user;
// userWithoutRole = { name: 'Alice', age: 25 }
```

Previously only arrays supported this; object spread officially entered the standard with ES2018.

## Async Iteration (for await...of)

```javascript
// Process multiple async operations in sequence
async function processItems(ids) {
  for await (const item of fetchItems(ids)) {
    await saveItem(item);
  }
}

// Custom async iterator
async function* generateSequence(start, end) {
  for (let i = start; i <= end; i++) {
    await delay(100);
    yield i;
  }
}

for await (const num of generateSequence(1, 5)) {
  console.log(num); // 1, 2, 3, 4, 5 (every 100ms)
}
```

## Regex Improvements

```javascript
// Named capture groups (very useful)
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/
const match = '2018-06-02'.match(re)
const { year, month, day } = match.groups
// year='2018', month='06', day='02'

// s flag: . matches newlines
const html = '<div>\n  content\n</div>'
/<div>(.*)<\/div>/s.test(html)  // true (previously required [\s\S])

// Lookbehind assertion
/(?<=\$)\d+/.exec('$100')  // matches 100 (previously only lookahead was available)
```

## Summary

- `Promise.finally` simplifies cleanup logic
- Object spread/rest is now an official standard
- `for await...of` is very convenient for handling async sequences
- Named capture groups greatly improve regex readability
