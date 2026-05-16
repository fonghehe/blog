---
title: "JavaScript Regular Expressions in Practice"
date: 2018-06-16 10:11:40
tags:
  - JavaScript
readingTime: 1
description: "Regular expressions are knowledge you always end up forgetting. Here's a collection of common patterns and real-world use cases."
---

Regular expressions are knowledge you always end up forgetting. Here's a collection of common patterns and real-world use cases.

## Basic Syntax

```javascript
// Two ways to create
const re1 = /pattern/flags    // literal (recommended)
const re2 = new RegExp('pattern', 'flags')  // use when creating dynamically

// Common flags
// i: case-insensitive
// g: global match (without g, only finds the first match)
// m: multiline mode (^ $ match start/end of each line)
// s: . matches newlines (ES2018)
```

## Common Character Classes

```javascript
// Metacharacters
\d  // digit [0-9]
\w  // alphanumeric + underscore [a-zA-Z0-9_]
\s  // whitespace (space, tab, newline)
\b  // word boundary
.   // any character (except newline; includes newline with s flag)

// Quantifiers
*   // 0 or more
+   // 1 or more
?   // 0 or 1
{n} // exactly n
{n,m} // n to m
{n,}  // n or more

// Non-greedy (add ? to be lazy)
.*?  // match as little as possible
```

## Common Methods

```javascript
const str = 'Hello World 2018'

// test: check if it matches, returns boolean
/\d+/.test(str)          // true

// match: extract match results
str.match(/\d+/)         // ['2018']
str.match(/[A-Z]/g)      // ['H', 'W']

// replace: substitute
str.replace(/\d+/, '2019')    // 'Hello World 2019'
str.replace(/[a-z]/g, '*')    // 'H**** W**** ****'

// replace with a function (powerful)
'hello_world'.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
// 'helloWorld' (underscore to camelCase)

// split: divide
'a, b , c'.split(/\s*,\s*/)   // ['a', 'b', 'c']

// matchAll (ES2020; use a loop for now)
const re = /(\d+)-(\d+)/g
let m
while ((m = re.exec(str)) !== null) {
  console.log(m[1], m[2])
}
```

## Real-World Scenarios

```javascript
// Validate Chinese mobile number
const isMobile = /^1[3-9]\d{9}$/.test(phone);

// Validate email (simplified — don't use an overly strict pattern)
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Extract URL query parameter
function getQueryParam(name) {
  const re = new RegExp(`[?&]${name}=([^&]*)`);
  const match = location.search.match(re);
  return match ? decodeURIComponent(match[1]) : null;
}

// Mask phone number: 138****8888
phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");

// Thousands separator: 1234567 → 1,234,567
String(num).replace(/\B(?=(\d{3})+$)/g, ",");

// camelCase to kebab-case: camelCase → camel-case
str.replace(/([A-Z])/g, "-$1").toLowerCase();

// Strip HTML tags
html.replace(/<[^>]+>/g, "");
```

## Named Capture Groups (ES2018)

```javascript
// Parse a date string
const dateRe = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const {
  groups: { year, month, day },
} = "2018-06-16".match(dateRe);

// Use named groups in replacements
"2018-06-16".replace(
  /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
  "$<day>/$<month>/$<year>",
);
// '16/06/2018'
```

## Summary

- `test()` checks for a match; `match()` extracts; `replace()` substitutes
- Add the `g` flag to match globally
- Named capture groups `(?<name>...)` make code more readable
- Use the online tool regex101.com to debug regular expressions
