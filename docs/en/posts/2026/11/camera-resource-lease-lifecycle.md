---
title: "Camera Preview Leases When Permission Resolves After the Page Closes"
date: 2026-11-05 14:40:22
tags:
  - JavaScript
  - Engineering
description: "Own media streams explicitly and clean up late results instead of confusing a hidden preview with a released device."
readingTime: 3
wordCount: 546
---

A user opens a scanning dialog, closes it during the permission prompt, then grants access. The camera indicator turns on even though the component is gone. Unmounting does not cancel an unfinished device request. Someone must still receive and release the late MediaStream.

Scanning, document photos, and previews need explicit resource ownership. This article treats a local capture session as a lease with a start and end; uploading, recording, and remote calls are outside its scope.

## Permission, device availability, tracks, and playback differ

Permission does not guarantee usable hardware. A device may be absent, busy, or unable to meet constraints. Video playback can fail independently. Reporting every failure as a permission problem sends users toward the wrong recovery action.

Classify actual failures and offer suitable retry or selection behavior instead of repeatedly prompting. [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/) specifies device requests and tracks. Verify secure context, embedding policy, and browser behavior in the deployment that will actually use the feature.

## Capture late results with a request generation

`getUserMedia` does not offer a general Fetch-style AbortSignal parameter. Advance a generation when closing the dialog. If an old request later succeeds, stop all its returned tracks. The same pattern prevents a slow previous camera choice from replacing a newer one.

```javascript
export function cameraSession(mediaDevices, video) {
  let generation = 0;
  let current = null;
  function stop() {
    generation++;
    if (current) {
      if (video.srcObject === current) video.srcObject = null;
      current.getTracks().forEach(track => track.stop());
      current = null;
    }
  }
  async function start(constraints = { video: true, audio: false }) {
    stop();
    const own = generation;
    let candidate;
    try {
      candidate = await mediaDevices.getUserMedia(constraints);
      if (own !== generation) {
        candidate.getTracks().forEach(track => track.stop());
        return false;
      }
      current = candidate;
      video.srcObject = candidate;
      await video.play();
      return own === generation;
    } catch (error) {
      if (own === generation) {
        stop();
        throw error;
      }
      candidate?.getTracks().forEach(track => track.stop());
      return false;
    }
  }
  return { start, stop };
}
```

The helper owns streams it obtains. Sharing their tracks elsewhere changes that ownership contract. Playback failure also requires cleanup. If a second start occurs while the first awaits playback, stop has already released the old stream. Callers must respect the returned generation result instead of interpreting every settled start promise as an active preview.

## Detaching a video element does not stop capture

Hiding the element or setting `srcObject` to null only disconnects presentation. Release this helper's owned resource by stopping every track. Forgetting audio can leave a microphone active; if audio is unnecessary, never request it.

Setting `enabled` false is a pause-like output control, not a replacement for releasing a device. Model pause separately if required. Finishing a scan, leaving the route, and destroying the component should all reach cleanup. Observe externally ended tracks too, so the interface does not keep claiming a working preview.

## Choose lifecycle policies deliberately

Whether capture should stop in the background depends on the task and platform. If it stops, restart through a clear user action or a permitted previously authorized flow, handling failure again. Unconditional reacquisition on every visibility event creates prompts and device contention.

If several components share capture, a manager should own the stream and track consumer leases or reference counts. Independent components stopping the same track interrupt one another. Conversely, a forgotten consumer must not hold the device forever; ownership and disposal need observable paths.

## Constraints need explicit fallback behavior

Separate required from preferred constraints. Mandatory unsupported dimensions fail; ideal constraints permit negotiation. If the business requires sufficient resolution, inspect actual track settings after negotiation. Do not report a requested facing direction as achieved without checking available behavior.

Test delayed permission after closure, rapid switching, denial, unavailable hardware, playback rejection, disposal, and an older request finishing last. Controlled promises can verify cleanup logic. Real permission dialogs, device indicators, and hardware require browser/device walkthroughs.

Give every stream an owner and every exit a release action. A disappeared interface should not leave a device working for a session that no longer exists.
