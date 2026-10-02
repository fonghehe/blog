---
title: "Cursor Pagination Consistency When Rows Are Inserted, Deleted, or Reordered"
date: 2026-10-02 10:28:31
tags:
  - JavaScript
  - Engineering
description: "Design stable boundaries, query identities, and snapshot semantics without confusing deduplication with completeness."
readingTime: 3
wordCount: 645
---

A ticket list has loaded two pages when another user inserts a ticket at the top. The next page repeats the previous page's last row. Removing duplicates makes the screen look plausible, but it does not recover rows skipped after deletions or changing sort keys. Pagination needs a definition of the next result before it needs a scrolling component.

This article uses a ticket list ordered by creation time as a design exercise. The examples are not a production incident report, and a clean-looking list is not evidence that every matching record was delivered.

## Page numbers track positions; cursors track boundaries

Start with A, B, C, D and a page size of two. After reading A and B, inserting X before A makes `OFFSET 2` return B and C. Deleting A instead can make the second page start at D, skipping C. Positions shift when the collection changes.

A cursor can carry the final row's ordering key. A timestamp alone is insufficient because several tickets can share it. Use `(created_at, id)` to establish a unique order and design a matching index. If nullable sort fields are supported, specify their placement explicitly; SQL's unknown comparison result must not become an undocumented pagination rule.

## Fetch one extra row to determine continuation

The query below shows the continuation branch. The first page omits the cursor predicate. To display 20 rows, request 21 and use the extra row to determine whether another page exists. Construct the next cursor from the twentieth row actually displayed, not the discarded twenty-first row, or one item will disappear. The relevant database behavior is documented in [PostgreSQL row comparisons](https://www.postgresql.org/docs/18/functions-comparisons.html) and [LIMIT/OFFSET](https://www.postgresql.org/docs/18/queries-limit.html).

```sql
-- $1: tenant, $2: cursor created_at, $3: cursor id
SELECT id, created_at, title
FROM tickets
WHERE tenant_id = $1
  AND (created_at, id) < ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT 21;
```

```javascript
export function appendPage(current, incoming) {
  const byId = new Map(current.map(row => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()];
}
```

The merge function only handles overlap. It retains existing positions while replacing data for repeated IDs. If updated fields affect sorting, define a separate reorder policy. A client cannot claim that server ordering is authoritative while silently sorting the merged list by another field.

## Bind a cursor to the query that created it

Switching from open tickets to all tickets invalidates the previous cursor. An opaque cursor can bind the tenant, filter digest, sort version, and final ordering key. Base64 provides encoding, not integrity. When tamper resistance matters, verify a signature or resolve server-held cursor state. Authorization must still run independently on every request.

On the client, generate a query key from normalized filters and ordering. Changing that identity resets the page chain and advances a request generation. Cancellation alone is insufficient: a response may already have arrived. Check the generation again before applying results so two filters cannot become one list. Cache entries belong to query identities, not merely page numbers.

## A stable boundary is not a frozen snapshot

An immutable creation key protects continuation from new rows at the top. A mutable priority key behaves differently: a ticket can cross the cursor and appear twice or move into an already-read region without ever being seen. Deduplication cannot recover an item that never arrived.

A live list may accept such movement, announce new content, and reset its boundary when the user refreshes. An audit export requires stronger semantics: a server snapshot, materialized result, or controlled consistent read. Adding an `asOf` filter usually limits new records; it does not freeze older records that can still change or disappear. Decide which product promise the endpoint makes before choosing a cache policy.

## Test transitions across the boundary

Exercise equal timestamps, insertions between pages, deletions between pages, changes to ordering fields, and a stale response arriving after a filter change. Client checks should cover displayed IDs and request generations. API checks should cover ordering and cursor construction. Snapshot mode also needs a completeness assertion against the frozen result.

Write the initial collection, mutation sequence, and returned pages as explicit fixtures. Repeated manual scrolling hides omissions too easily. Concrete sequences let reviewers decide which changes are acceptable in a live feed and which must force a refresh.
