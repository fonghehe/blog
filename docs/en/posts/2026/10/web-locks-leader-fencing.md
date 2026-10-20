---
title: "Multi-Tab Leadership: Web Locks Need Server-Side Fencing for Writes"
date: 2026-10-20 09:57:55
tags:
  - JavaScript
  - Engineering
description: "Separate browser mutual exclusion, task lifetime, and authority to update shared server state."
readingTime: 3
wordCount: 581
---

Five open report tabs create five polling loops. A localStorage leader flag appears to reduce requests, but two tabs can both read an empty value and then write themselves as leader. Timeout-based takeover adds background suspension and changing system clocks to the problem.

Web Locks coordinates contexts within its browser storage scope. That is local mutual exclusion. Once a page sends a server mutation, closing the page cannot guarantee that the request disappears.

## A browser lock is not an account-wide lock

Resource names are application contracts. Include relevant tenant and task identity so unrelated work does not contend and identical work does not use different names. Consult the [Web Locks specification](https://www.w3.org/TR/web-locks/) for API and environment requirements, and verify target browsers. Storage partitioning in embedded contexts can affect which contexts cooperate.

A lock in one browser cannot stop another computer from running the same operation. Repeated report reads may only waste resources. Billing, notifications, and mutations require server-enforced idempotency or exclusion. Classify side effects before deciding that a client lock is enough.

## The callback promise defines the lock lifetime

The example uses `ifAvailable`: if another context holds the lock, skip this attempt rather than queueing every poll for later. Await the actual work inside the callback. Starting an unawaited promise and returning releases the lock prematurely. Pass cancellation to the work so it can stop Fetch, waits, and loops.

```javascript
export async function runAsLeader(locks, signal, work) {
  if (signal.aborted) throw signal.reason;
  return locks.request('report-refresh:v1', {
    mode: 'exclusive',
    ifAvailable: true,
  }, async lock => {
    if (!lock) return false;
    if (signal.aborted) throw signal.reason;
    await work(signal);
    return true;
  });
}

// Browser call site; work must stop when signal is aborted.
// await runAsLeader(navigator.locks, controller.signal, refreshReports);
```

The signal is not passed as a lock option because this is an immediate-availability mode, not a queued wait. The helper cannot forcibly cancel uncooperative work. A function that ignores its signal retains the lock until its promise settles. Production code also needs start deduplication, failure handling, and backoff so timers within one tab do not repeatedly compete.

## Local release does not revoke a remote request

Leader A submits an update and is suspended. B takes over and writes a newer result. A's delayed request can still arrive afterward and overwrite B. Browser exclusion cannot tell the server which result has become stale. Use a write version, compare-and-swap, or an authoritative monotonic fencing token.

With fencing, the server compares the token and updates the resource atomically, rejecting writes that violate the ownership rule. Independently generated tab timestamps are not an authoritative token sequence. For repeated execution of one business command, use an idempotency key too. These mechanisms answer different questions: whether this is the same command, and whether this worker still has authority to write.

## Broadcasts notify; they do not prove ownership

BroadcastChannel can announce a new result, but it is neither a persistent queue nor an authorization mechanism. A newly opened tab may have missed messages and must load durable state. Existing tabs should compare resource versions before refreshing rather than executing arbitrary actions supplied by a message.

Expose useful states such as waiting, refreshing, stale result, and retrying. Hiding a page does not mean its task is permanently terminated; revalidate on recovery. Forcibly stealing a lock to hide a timeout can leave old work running and turn duplicate reads into concurrent writes.

## Test takeover with controlled delays

Cover simultaneous starts, closing the leader, thrown errors, cancellation, and resuming a background tab. On the server, deliberately delay A until B finishes and verify rejection of A's stale token. Checking only that a second browser callback did not run misses the actual data risk beyond the browser boundary.

Coordinate report reads first, then decide which mutations need authoritative leases and version checks. The lock saves repeated work; server constraints protect shared data correctness.
