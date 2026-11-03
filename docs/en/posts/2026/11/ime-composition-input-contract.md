---
title: "IME Composition Contracts for Search Inputs"
date: 2026-11-03 10:28:18
tags:
  - JavaScript
  - Engineering
description: "Separate candidate text from committed business input to prevent lost characters, accidental submits, and duplicate work."
readingTime: 3
wordCount: 563
---

A user presses Enter to choose a Chinese candidate, but the page submits unfinished phonetic text. Another field rewrites its value after every change and closes the candidate window. English keyboard testing cannot establish that composition-based input works.

The example is a standalone native search input. Controlled framework fields, rich editors, and mobile keyboards need their own integration checks; one listener cannot certify every environment.

## Candidate text is not the final business value

Between composition start and end, the input method maintains candidates and intermediate text. Users can revise or cancel that text. Displaying it is reasonable, but automatic search, persistence, truncation, and formatting need an explicit intermediate-state policy.

Avoid forcing a sanitized value back into the DOM during composition. DOM value, selection, and input-method state can diverge. Controlled components can update a display draft while delaying business submission. Ignoring every event is not equivalent: the next render may restore the previous value and erase the draft.

## Use both event metadata and local composition state

[UI Events](https://w3c.github.io/uievents/#events-compositionevents) defines composition events, while [Input Events](https://www.w3.org/TR/input-events-2/) describes editing intentions. Boundary ordering still requires browser, OS, and input-method testing. This native listener suppresses business changes during composition, reads the final DOM value afterward, and deduplicates against the last published value.

```javascript
export function bindSearch(input, onChange, onSubmit) {
  let composing = false;
  let active = true;
  let last = input.value;
  const publish = () => {
    if (!active || composing || input.value === last) return;
    last = input.value;
    onChange(last);
  };
  const start = () => { composing = true; };
  const end = () => {
    composing = false;
    queueMicrotask(publish);
  };
  const change = event => {
    if (!event.isComposing) publish();
  };
  const key = event => {
    if (event.key !== 'Enter' || composing || event.isComposing) return;
    event.preventDefault();
    publish();
    onSubmit(input.value);
  };
  const listeners = [
    ['compositionstart', start], ['compositionend', end],
    ['input', change], ['keydown', key],
  ];
  for (const [name, fn] of listeners) input.addEventListener(name, fn);
  return () => {
    active = false;
    for (const [name, fn] of listeners) input.removeEventListener(name, fn);
  };
}
```

The microtask coalesces reads in the current event sequence; it is not a universal ordering guarantee. If final input arrives in a later task, that event can still publish its new value. Equal values are suppressed. Enter behavior must also be checked on supported systems. Compatibility workarounds should identify a concrete environment rather than accumulate unexplained delays.

## Candidate confirmation and search submission are separate intentions

The first Enter may confirm a candidate and the next may submit. A global capture listener that consumes every Enter prevents the field from handling that distinction. Define priority among form submission, global shortcuts, and the input. This standalone example owns Enter; integrating it into a form must not introduce a second submission path.

A changed value and an explicit submit differ too. The helper deduplicates `onChange`, but allows `onSubmit` with the same keyword because the user may request a refresh. Query identities, request generations, and debounce belong to the network layer rather than being hidden in composition handling.

## Validation must allow editable intermediate states

A minus sign, decimal point, or trailing space may be invalid as a final value while remaining a natural editing step. Keep a draft that can express intermediate states, then convert on blur or submit. Character limits should specify their unit and should not truncate halfway through composition.

Paste, voice entry, autofill, and undo may not produce expected keydown sequences. Derive changes from input rather than keys alone. Selection replacement, cancellation, and focus movement also need consistent draft and caret behavior. Check query identity when asynchronous suggestions arrive so older suggestions do not overwrite ongoing input.

## Synthetic events cover only part of the path

Unit tests can exercise flags, deduplication, disposal, and known event sequences. Dispatching composition events does not reproduce a real operating-system candidate window. Use Chinese and Japanese input methods on supported desktop and mobile systems to confirm candidates, cancel, press Enter, and type continuously.

Record OS, browser, input method, and event order. Acceptance means no lost final text, no submit while choosing a candidate, and no duplicated request for one effective change. Evidence makes compatibility fixes explainable instead of turning them into arbitrary timers.
