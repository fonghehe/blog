---
title: "Large Download Memory Budgets and Cancelable File Pipelines"
date: 2026-10-22 09:34:27
tags:
  - JavaScript
  - Performance
description: "Separate receiving, transforming, and saving so a completed progress bar does not certify a complete file."
readingTime: 3
wordCount: 585
---

For a small export, fetching a Blob and creating an object URL is convenient. As files grow, the browser may retain response data, a Blob, and normal application objects together. Low-memory devices fail first. Switching to a reader does not solve this if every chunk is still collected in an array.

Ask whether JavaScript must transform the bytes, whether supported browsers can write to a user-selected file, and what failure should leave behind. Often the cheapest solution is a conventional server download managed by the browser.

## Prefer browser-managed downloads when no transformation is needed

An authorized download response can avoid creating one whole-file JavaScript object. Verify cross-origin behavior, filename handling, and credentials in the actual deployment; the `download` attribute is not universally decisive. Signed URLs need narrow scope and expiry, and should not be copied into analytics logs.

Take ownership of the byte stream only when inspection or transformation requires it. If direct file writing is unsupported, fall back to server download or an asynchronous export job. An unbounded Blob fallback does not have the same memory behavior as streaming to disk.

## Choose a destination within the user gesture

[File System Access](https://wicg.github.io/file-system-access/) pickers have context and user-activation requirements. Detect support and ask for the destination from the click flow before waiting for a long network operation. Asking only after the download may lose activation. Distinguish canceling a picker from a network failure.

The helper injects the picker for testing and accepts only a complete response, not Range continuation. See the [Streams Standard](https://streams.spec.whatwg.org/) for pipeline behavior and the [File System Standard](https://fs.spec.whatwg.org/) for writable file interfaces.

```javascript
export async function saveResponse(url, chooseFile, signal, onBytes = () => {}) {
  const handle = await chooseFile();
  const writable = await handle.createWritable();
  try {
    const response = await fetch(url, { signal });
    if (response.status !== 200 || !response.body) {
      throw new Error(`download rejected: ${response.status}`);
    }
    let received = 0;
    const meter = new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        onBytes(received);
        controller.enqueue(chunk);
      },
    });
    await response.body.pipeThrough(meter).pipeTo(writable, { signal });
    return received;
  } catch (error) {
    try { await writable.abort(error); } catch { /* preserve original error */ }
    throw error;
  }
}

// Invoke directly from a click handler in a supported secure context:
// saveResponse(url, () => window.showSaveFilePicker(), signal, renderBytes);
```

Mark the UI saved only after `pipeTo` resolves. On failure, attempt to abort writing while preserving the original error. Verify browser and filesystem behavior rather than promising no temporary content can ever remain. Unconditionally closing a file in `finally` can turn a partial result into an apparently successful save.

## Progress numerator and denominator must describe the same bytes

This example reports received body bytes without inventing a percentage. Content length may be absent, and encoded transfer length can differ from the decoded body exposed to JavaScript. If the server knows a stable logical total, expose it explicitly. Otherwise, received bytes and indeterminate progress are more honest than a bar exceeding one hundred percent.

Separate receiving, conversion, and saving phases. The network can finish before closing the file fails. Bound transformer queues too: stream backpressure coordinates participating stages but cannot stop an application callback from retaining every chunk on its own.

## Resuming needs resource identity, not just an offset

Adding Range support requires a stable resource version, status and range validation, total-size checks, and a policy for servers that ignore the range and return 200. Appending blindly can combine two different versions into a corrupt file. With compression or encryption, offsets must refer to the correct representation layer.

Recoverable exports often work better as stable server-generated objects with a job ID, version, and verification metadata. The client manages resumption against that object. A writable stream's seek operation does not replace a continuation protocol.

## Verify memory and failure artifacts

Use a controlled large response and slow sink to check that memory does not grow linearly with the whole file. Cover cancellation before and during transfer, write failure, missing response bodies, and error status. Record device, file size, and observed peak memory instead of claiming an unmeasured percentage improvement.

Document supported browsers and fallbacks. Acceptance should reopen or verify the saved file, because a completed progress bar only describes interface state, not file integrity.
