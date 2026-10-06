---
title: "Unicode Offset Contracts for Highlighting, Selections, and Character Limits"
date: 2026-10-06 11:29:53
tags:
  - JavaScript
  - Engineering
description: "Separate UTF-16 units, code points, and grapheme clusters before converting positions between systems."
readingTime: 3
wordCount: 602
---

A note field accepts twenty characters but rejects a short family-emoji message. Elsewhere, search highlighting separates an accent from its letter. Both failures often start with the same assumption: string length, visible characters, and API offsets share one unit.

Inputs, subtitles, annotation tools, and editors need a text coordinate contract. An emoji regular expression cannot substitute for that contract. The examples here concern plain text; they do not attempt to implement a rich-text document model.

## Three lengths answer different questions

JavaScript's `length` counts UTF-16 code units. String iteration exposes code points, but one perceived character can contain several code points: combining accents, skin-tone modifiers, flags, and zero-width-joiner sequences are useful test cases. Grapheme clusters are a better unit for visible-character truncation, though they still do not measure rendered width.

Name storage limits, protocol offsets, and interface counters separately. Fields such as `maxUtf8Bytes`, `startUtf16`, and `graphemeCount` prevent more mistakes than an unqualified `length`. A byte-based service and UTF-16 client can pass every ASCII test while disagreeing immediately on real names and emoji.

## Segment visible characters instead of slicing arbitrary units

[Unicode text segmentation](https://unicode.org/reports/tr29/) defines grapheme boundaries, and JavaScript exposes [Intl.Segmenter](https://tc39.es/ecma402/#segmenter-objects). The function below truncates at those boundaries without splitting the family sequence. It returns only the retained text. Whether to append an ellipsis, and whether that ellipsis consumes the limit, belongs to the caller's contract.

```javascript
export function truncateGraphemes(text, limit, locale = 'en') {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('invalid limit');
  }
  const segmenter = new Intl.Segmenter(locale, {
    granularity: 'grapheme',
  });
  let result = '';
  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (count === limit) break;
    result += segment;
    count++;
  }
  return result;
}

const text = 'A👨‍👩‍👧‍👦e\u0301';
console.assert(text.length > 3);
console.assert(truncateGraphemes(text, 2) === 'A👨‍👩‍👧‍👦');
```

Check the target runtime for `Intl.Segmenter`. If it is unavailable, use a maintained segmentation implementation. Falling back to `Array.from(text)` changes the unit to code points and must not be advertised as equivalent. Runtime Unicode data versions can differ too; pin rules and a shared corpus when client/server equality is essential.

## An offset belongs to a particular document version

An API returning `[start, end)` must specify UTF-16 units, UTF-8 bytes, or code points. Half-open ranges represent empty selections and adjacent spans conveniently, but they do not solve unit mismatches. Include a document revision and, when useful, a snippet check. A range from an older revision cannot safely be applied after arbitrary edits.

Plain text input selection positions use UTF-16 offsets. A code-point annotation service can be adapted with a boundary-to-UTF-16 mapping. DOM Range introduces a different concern: positions belong to particular nodes. A whole-document string offset is not automatically a node-local offset. Keep these conversions in one adapter rather than repeating them throughout rendering code.

## Normalization changes coordinates as well as representation

A precomposed `é` and `e` followed by a combining accent can look alike while having different underlying lengths. NFC may suit comparison or indexing, but applying it after capturing a selection invalidates the old coordinate system. If search operates on normalized text, preserve a mapping to original positions or return ranges against an explicitly normalized document revision.

NFKC is not a free cleanup operation either; it can change compatibility characters. Identifier comparison, legal-document retention, and user-authored text have different goals. Preserve the original, derive a search representation, and truncate for display as separate operations rather than repeatedly mutating the same string.

## Character limits need a product definition

Does a twenty-character label mean twenty graphemes, forty bytes, or one rendered line? Layout measures the last case; encoding validation handles storage capacity. A field can report both visible count and remaining bytes, but a server rejection should explain the actual constraint. Avoid truncating a composition session before the input method has committed its candidate.

Use a fixed corpus containing Chinese, Japanese, combining marks, flags, skin tones, and family sequences. Verify truncation, copying, deletion, and highlight round trips. The useful assertion is that a converted range still selects the intended original text, not merely that two counters happen to match.
