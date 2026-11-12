---
title: "Money Input and Rounding Contracts Beyond Two Displayed Decimals"
date: 2026-11-12 15:33:05
tags:
  - JavaScript
  - Engineering
description: "Use decimal text, integer minor units, and explicit allocation rules without treating formatting as arithmetic correctness."
readingTime: 3
wordCount: 614
---

A screen showing `0.10 + 0.20 = 0.30` does not establish a correct money model. Formatting with `toFixed(2)` says nothing about intermediate arithmetic, negative refunds, or allocation across rows. Two systems can both promise two decimals while rounding at different stages in different directions.

This article concerns software representation and validation, not accounting or tax rules. The example supports a business currency explicitly defined with two decimal places. Other currencies and higher-precision assets need their own scale contracts.

## Separate input drafts, business values, and display

A temporary minus sign or `1.` is a normal editing state. Preserve raw draft text and parse strictly on submission rather than resetting every incomplete value. Localized display is a separate representation; grouping separators and currency symbols should not flow back into arithmetic.

JavaScript Number uses binary floating point; see [ECMAScript Number](https://tc39.es/ecma262/#sec-number-objects). Decimal libraries and integer minor units are possible models, each needing range, scale, and multiplication/division policies. `Math.round(Number(text) * 100)` still converts through binary floating point first and is not a universal decimal parser.

## Parse decimal text directly into minor units

The function accepts bounded text without grouping or exponent notation and with at most two fractional digits. It constructs BigInt cents directly. It rejects `.5`, `1.`, excess precision, and leading-zero variants. Those are explicit input-policy choices that client and server should share.

```javascript
export function parseCents(text) {
  if (typeof text !== 'string' || text.length > 128) {
    throw new TypeError('bounded decimal text required');
  }
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('invalid two-decimal amount');
  const magnitude = BigInt(match[2]) * 100n +
    BigInt((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -magnitude : magnitude;
}

export function roundRatioHalfAway(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError('positive denominator required');
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

console.assert(parseCents('0.10') + parseCents('0.20') === 30n);
console.assert(roundRatioHalfAway(-5n, 2n) === -3n);
```

BigInt avoids Number's safe-integer limitation for this arithmetic, but input length still needs bounds. JSON does not serialize BigInt directly, so an API can exchange decimal integer strings with explicit currency and unit. The server must validate range independently rather than trusting client parsing.

## Specify rounding direction and stage

The ratio helper rounds midpoint values away from zero, making -2.5 become -3. That is one chosen algorithm, not a universal business rule. Ties-to-even, floor, and cash-denomination rounding can differ and require an authoritative business decision.

Also specify whether rounding occurs per line, per category, or after aggregation. Rounding each line before summation can differ from rounding the total. Represent rates with rational numerators/denominators or a decimal implementation rather than repeatedly formatting intermediate values and converting them back.

## Allocation must preserve the total

Splitting 100 cents into three individually rounded 33-cent shares yields only 99 cents. One policy allocates a floor share of 33, then assigns the remaining cent in a stable order: 34, 33, 33. Unequal weights need remainder ordering and deterministic tie-breaking. Stable IDs are more reproducible than current screen order.

Refunds should reference original allocation records when possible rather than recomputing under today's ordering. Otherwise, sorting a table can change which line receives a refund cent. Retain the applied policy and final allocation so each line can be reconciled with the total.

## Localization formats values; it does not define parsing

[Intl.NumberFormat](https://tc39.es/ecma402/#numberformat-objects) is a formatting API, not a universal localized money parser. A comma can be a grouping or decimal separator, and spaces can be locale separators. Supporting several input styles needs an explicit locale and parsing policy. Removing all commas is not that policy.

Do not convert enormous integer minor-unit values to Number merely to format them. Convert only within a proven safe business range or use a precision-preserving decimal display path. Avoid representing negative zero as a meaningful refund; the example's BigInt model normalizes it to zero.

## Verify invariants across the whole flow

Cover minor-unit boundaries, supported maximums, exponents, oversized input, excess decimals, negative midpoint cases, and allocations whose sum equals the original total. Round-trip serialized values with their currency and unit. Use shared client/server fixtures instead of checking only that both interfaces show two decimals.

Document accepted input, internal representation, rounding stage, and remainder allocation. Correctness should follow from these rules rather than the last formatting step making a value look plausible.
