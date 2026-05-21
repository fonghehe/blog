---
title: "Advanced JavaScript Regular Expressions"
date: 2018-07-14 09:32:14
tags:
  - JavaScript
readingTime: 1
description: "I know basic regex, but complex requirements at work still trip me up. Here are some advanced techniques."
wordCount: 74
---

I know basic regex, but complex requirements at work still trip me up. Here are some advanced techniques.

## Common Special Characters

```javascript
// Character classes
\d  digit [0-9]
\w  word character [A-Za-z0-9_]
\s  whitespace (space, tab, newline)
\D  non-digit, \W non-word, \S non-whitespace

// Quantifiers
?   0 or 1 times
*   0 or more times
+   1 or more times
{n} exactly n times
{n,m} n to m times

// Anchors
^   start of string
$   end of string
\b  word boundary
```

## Capture Groups

```javascript
// Capture groups: extract matched parts
const date = "2018-07-14";
const match = date.match(/(\d{4})-(\d{2})-(\d{2})/);
// match[0]: '2018-07-14' (full match)
// match[1]: '2018' (group 1)
// match[2]: '07' (group 2)
// match[3]: '14' (group 3)

// Named capture groups (ES2018)
const match2 = date.match(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/);
console.log(match2.groups.year); // '2018'
console.log(match2.groups.month); // '07'
```

## Using Capture Groups in Replacements

```javascript
// Date format conversion: 2018-07-14 → 07/14/2018
"2018-07-14".replace(/(\d{4})-(\d{2})-(\d{2})/, "$2/$3/$1");
// '07/14/2018'

// Phone number masking: 138****5678
"13812345678".replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
// '138****5678'
```

## Non-greedy Matching

```javascript
// Greedy (default): match as much as possible
"<a>text</a><b>bold</b>".match(/<.+>/);
// ['<a>text</a><b>bold</b>']  — whole string matched

// Non-greedy (add ?): match as little as possible
"<a>text</a><b>bold</b>".match(/<.+?>/);
// ['<a>']  — only first tag matched
```

## Common Regex Patterns

```javascript
// Email
const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone number (China mainland)
const phoneReg = /^1[3-9]\d{9}$/;

// URL
const urlReg = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;

// ID card (simple)
const idCardReg = /^\d{17}[\dX]$/;

// Usage
function validateEmail(email) {
  return emailReg.test(email);
}
```

## Common Methods

```javascript
const str = "hello world hello";
const reg = /hello/g;

// test: does it match?
reg.test(str); // true

// match: return match array
str.match(/hello/g); // ['hello', 'hello']

// replace: replace matches
str.replace(/hello/g, "hi"); // 'hi world hi'

// split: split string
"a,b;c d".split(/[,; ]/); // ['a', 'b', 'c', 'd']

// matchAll (ES2020): return detailed info for all matches
const matches = [...str.matchAll(/hello/g)];
```

## Summary

- Named capture groups `(?<name>...)` make code more readable
- Non-greedy `+?` `*?` solve greedy matching problems
- `g` flag for global matching, `i` for case-insensitive, `m` for multiline
- For complex regex, add comments or use a testing tool (like regex101.com)
