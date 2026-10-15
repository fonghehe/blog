---
title: "Reading SSE with Fetch: Network Chunks Are Not Message Boundaries"
date: 2026-10-15 09:06:03
tags:
  - JavaScript
  - Engineering
description: "Separate incremental decoding, event framing, cancellation, and application completion in streaming interfaces."
readingTime: 3
wordCount: 578
---

The server sends complete JSON messages, yet the client occasionally fails to parse one. Packet inspection looks fine and retrying succeeds. A common cause is parsing each `reader.read()` result as JSON. Transport can split a character or combine multiple events in a single chunk.

A streaming interface has at least four boundaries: bytes, text, events, and application state. Keeping them separate makes it possible to distinguish decoding failure from framing failure or a missing completion message.

## Preserve decoder state across chunks

UTF-8 text can be split in the middle of a multibyte character. Creating a fresh decoder for each chunk loses unfinished bytes. Maintain one streaming decoder and flush it, or use `TextDecoderStream`. Decoding does not discover JSON boundaries; the resulting text may still contain only part of an event.

SSE framing comes next. General SSE also includes event types, IDs, and reconnection semantics. Prefer native `EventSource` or a maintained implementation. Native EventSource does not accommodate every custom-header or request-body requirement, so choosing Fetch means choosing which protocol work to own. See the [HTML event-stream rules](https://html.spec.whatwg.org/multipage/server-sent-events.html) and [Encoding Standard](https://encoding.spec.whatwg.org/#interface-textdecoder).

## The example implements a restricted data-only contract

This generator requires an explicit server contract using LF or CRLF lines and `data:` fields. It does not handle lone CR delimiters, event IDs, event types, or reconnection instructions. It is not a complete EventSource replacement. Multiple data lines are joined before delivery. The buffer bound counts JavaScript string units, not an exact memory budget in bytes.

```javascript
export async function* readDataEvents(body, maxChars = 65536) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  let data = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).replace(/\r$/, '');
        pending = pending.slice(end + 1);
        if (line === '') {
          if (data.length) yield data.join('\n');
          data = [];
          size = 0;
        } else if (line.startsWith('data:')) {
          const part = line.slice(5).replace(/^ /, '');
          size += part.length + 1;
          if (size > maxChars) throw new Error('event too large');
          data.push(part);
        }
        if (line.length > maxChars) throw new Error('line too large');
      }
      if (pending.length + size > maxChars) throw new Error('buffer too large');
    }
    if (pending || data.length) throw new Error('incomplete application event');
  } finally {
    try { await reader.cancel(); }
    finally { reader.releaseLock(); }
  }
}
```

Under this application contract, unfinished data at EOF is an error. Do not infer general SSE EOF behavior from that choice. An empty data line can still produce an event, while comments and other fields are ignored by this subset. The caller must check HTTP status and content type before parsing; an HTML proxy error should not masquerade as a quiet event stream.

## Parsing JSON does not prove that work completed

Each yielded value is one event's complete data string. Parse and validate its business schema there. An event may describe progress, an error, or completion rather than one token. Request IDs and monotonic sequence numbers help distinguish duplicate events and results from superseded requests.

Transport EOF is not application success. Define an explicit completion message with final status or output verification data. If a connection closes after substantial output but before that message, retain the partial result and show interruption. Recovery requires server event retention, a cursor, and replay semantics; reconnecting from the start and appending blindly is not recovery.

## Cancellation must reach the consumer and rendering work

Cancel Fetch when a user changes requests, and stop the consumer and pending rendering. The generator's `finally` releases its reader; early iterator exit should reach that cleanup too. Already queued UI updates still need request-identity checks, or canceled content can reappear.

Rendering may be slower than receiving. Batch visible updates by frame, cap retained events and text, and avoid relaying out the whole page for every character. Backpressure coordinates consumption but does not erase all proxy and server buffers. Distinguish an idle timeout from a total task deadline, and do not count a heartbeat as meaningful business progress.

## Test arbitrary byte splits

Split one encoded event sequence at every byte position and expect identical reconstruction. Also test one-byte chunks, multiple events per chunk, split CRLF, and split Chinese characters. Include oversized lines, incomplete frames, missing completion, and cancellation during consumption. Verify page state as well as parsing so receiving output cannot accidentally mean completing the task.
