---
title: "Undo and Redo Command History: Define the Operation Before the Stacks"
date: 2026-10-27 15:18:29
tags:
  - JavaScript
  - Engineering
description: "Use caption editing to examine inverse commands, grouping, saved baselines, and external side effects."
readingTime: 3
wordCount: 555
---

Dragging an object generates eighty updates, but Undo moves it back by only one pixel. Another implementation snapshots the entire component and restores collapsed panels and loading flags along with the document. The hard part is defining one meaningful operation, not maintaining two arrays.

This example edits text on existing captions with stable IDs. It covers local replacements only, without insertion, deletion, collaboration, or network rollback.

## Record domain changes rather than the whole interface

Caption content, ordering, and timing belong to the document. Selection, playback position, and hover state belong to interaction. Whether text undo restores a selection is a separate policy. Snapshotting the entire UI can resurrect stale request flags and invalid resource references.

Commands should target stable IDs. “Change the third row” can affect a different caption after reordering. Include a version or precondition when needed, and do not silently skip a missing target while reporting success.

## Inverse commands have preconditions

The history below records before and after values. Undo checks that the current value still matches the expected result. If that check fails, it throws before moving stack entries, leaving conflict resolution to the caller. Blind replacement would erase an external change. This is a teaching model; production code should encapsulate its state and arrays.

```javascript
export class CaptionHistory {
  constructor(initial, limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit');
    this.state = { ...initial };
    this.past = [];
    this.future = [];
    this.limit = limit;
  }
  apply(command, reverse = false) {
    const expected = reverse ? command.after : command.before;
    const next = reverse ? command.before : command.after;
    if (this.state[command.id] !== expected) throw new Error('revision conflict');
    this.state = { ...this.state, [command.id]: next };
  }
  execute(id, after) {
    if (!Object.hasOwn(this.state, id) || typeof after !== 'string') {
      throw new Error('unknown caption or invalid text');
    }
    const command = { id, before: this.state[id], after };
    if (command.before === after) return;
    this.apply(command);
    this.past.push(command);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo() {
    const command = this.past.at(-1);
    if (!command) return false;
    this.apply(command, true);
    this.past.pop();
    this.future.push(command);
    return true;
  }
  redo() {
    const command = this.future.at(-1);
    if (!command) return false;
    this.apply(command);
    this.future.pop();
    this.past.push(command);
    return true;
  }
}
```

A new command clears redo because that branch belongs to an abandoned future. No-op edits do not enter history. A command-count cap is not a byte budget: large strings still consume memory. Editors with images or binary resources should retain managed references instead of copying whole payloads into every entry.

## Group by user intent

Continuous typing may become one command, but a fixed millisecond window is insufficient. Cursor movement, caption switching, paste, and input-method confirmation can close a group. During dragging, capture the initial value, preview movements, and commit one command on release. Canceling returns to the initial value without adding history.

A transaction containing multiple document changes should enter history only after all changes succeed. If a step fails, restore completed parts. Inverse operations often run in reverse order, but external effects may not have a true inverse. Local text history does not make every feature reversible.

## Saved state is not stack length

After saving, further edits followed by Undo may restore exactly the saved content. A `past.length > 0` dirty check still reports changes. Conversely, a capped stack can keep the same length while content changes. Compare document state with a saved baseline fingerprint or revision instead.

An asynchronous save belongs to the snapshot submitted. If A is being saved while the user creates B, success establishes A as the server baseline; it does not certify B as saved. A failed save should not discard local history, because editing and undo remain useful recovery options.

## Network effects and collaboration need another protocol

Undoing a sent email cannot mean restoring a button's local state. External effects require cancellation, compensation, or a new business command with an explicit recovery promise. In collaboration, old before values may no longer apply. Operation transformation, a collaborative model, or conflict handling is needed; the precondition in this example detects conflict but cannot merge it.

Test repeated undo/redo, branching after undo, no-ops, missing targets, capacity trimming, edits during saving, and composition/drag boundaries. [Input Events](https://www.w3.org/TR/input-events-2/) provides context for browser editing history. Do not let native undo and application history both consume the same gesture.
