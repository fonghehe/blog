---
title: "ETags for Concurrent Editing Without Silent Lost Updates"
date: 2026-11-10 11:31:22
tags:
  - JavaScript
  - Engineering
description: "Connect conditional writes, preserved drafts, and three-way comparison into a recoverable conflict flow."
readingTime: 3
wordCount: 550
---

Two people open one configuration. One changes its title, the other later saves a note, and the title disappears despite both seeing success. Disabling a button prevents duplicate clicks in one page; it cannot coordinate other tabs, users, or background jobs.

The API must identify the revision behind a change. This article covers optimistic concurrency for whole-document PUT, not collaborative editing or an assumption that browser caching protects mutations.

## Retain both the representation and its validator

When loading a document, keep the representation and ETag as the editing baseline. Submit `If-Match` so the server writes only if the current representation still matches. A failed condition produces 412 and a conflict state. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match) defines conditional-request and strong-comparison semantics.

A write validator must meet strong-comparison requirements. Removing `W/` does not convert a weak validator into a strong one. Treat the server's ETag as opaque. Cross-origin APIs also need to expose the response header and permit the request header, or the browser cannot use information that the server actually sent.

## Compare and update atomically

The client below returns a conflict without overwriting. The SQL illustrates a version-conditional update; authorization, business validation, and HTTP mapping remain server responsibilities. It does not require the ETag to equal the database version directly. The server owns that mapping.

```javascript
export async function saveDraft(url, draft, etag, signal) {
  if (!etag || etag.startsWith('W/')) {
    throw new Error('a strong revision validator is required');
  }
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify(draft),
    signal,
  });
  if (response.status === 412) return { kind: 'conflict', draft };
  if (!response.ok) throw new Error(`save failed: ${response.status}`);
  return {
    kind: 'saved',
    etag: response.headers.get('ETag'),
  };
}
```

```sql
-- Execute atomically; zero updated rows means the expected version lost.
UPDATE documents
SET body = $1, version = version + 1
WHERE id = $2 AND tenant_id = $3 AND version = $4
RETURNING version;
```

Reading a version, comparing it in application code, and then issuing an unconditional update creates another race. Use a conditional update or equivalent atomic mechanism. Zero updated rows can also mean deletion or an authorization condition failed, so the server must distinguish outcomes without leaking protected resource existence.

## Preserve three inputs when resolving a conflict

Keep the original baseline, current local draft, and latest remote representation. Three-way comparison can identify disjoint edits, but safe merging depends on business meaning. Amount and currency are separate fields with coupled semantics; arrays cannot generally be merged by index.

Show understandable differences and let the user accept remote data, preserve local intent, or edit a resolution. A new submission should use the latest baseline and another conditional write. Do not silently fall back to an unconditional PUT. Automatically retrying 412 against fresh validators merely recreates last-writer-wins behavior.

## Success belongs to the submitted snapshot

If A is saving while the user edits B, A's success must not mark all of B saved. Associate the request with a local revision and advance only its baseline, retaining newer edits. The returned ETag identifies the confirmed server result, not whatever happens to be in the field when the response arrives.

The helper permits a successful response without ETag. The UI can acknowledge saving, but must retrieve a validator before another protected write. If the server normalizes content or supplies defaults, return the resulting representation or reread it so the local baseline matches stored data.

## Timeouts and conflicts need different recovery

A 412 says the condition failed. A network timeout may mean a successful write lost its response. Do not assert that nothing saved. Reread and compare a business revision, or query a server-supported request identity. Idempotency addresses repeat execution; revision validation addresses lost updates.

Test two clients saving from one baseline, edits during saving, deletion, missing cross-origin headers, response loss, and server normalization. Assert preserved drafts and the next validator as well as status codes. An explainable conflict is more dependable than two misleading success messages.
