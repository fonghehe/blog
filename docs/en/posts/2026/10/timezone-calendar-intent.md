---
title: "Storing Appointment Intent Separately from Time Zones and Instants"
date: 2026-10-08 14:11:42
tags:
  - JavaScript
  - Engineering
description: "Model recurring meetings, all-day dates, and daylight-saving ambiguity without losing what the user requested."
readingTime: 3
wordCount: 641
---

Every Monday at nine in New York is not the same schedule as every 168 hours. Across a daylight-saving transition, a form that stores only the first UTC value can shift later meetings by an hour. The formatting function is often innocent; the stored model has discarded the user's calendar intent.

Appointments, billing dates, and all-day holidays should not share an unexplained timestamp field. First decide whether the product preserves a local clock reading or a precise elapsed interval.

## Give three kinds of time different models

An audit event that already occurred can store an unambiguous instant, such as an ISO string ending in `Z`. A birthday or all-day holiday is a calendar date, without an invented midnight in a particular zone. A future local appointment needs at least a local date-time and an IANA zone identifier. Once confirmed, retain the resolved instant and offset when useful for explaining that decision.

A fixed offset such as UTC+8 is not a regional rule set. Regional rules can change, so the product must decide whether future meetings follow updated rules. The [Temporal time-zone documentation](https://tc39.es/proposal-temporal/docs/timezone.html) explains the distinction between exact and wall-clock time. This article uses that distinction without assuming any particular Temporal implementation is available in the target browser.

## The same clock time can occur twice

The two instants below both display as 01:30 on November 1, 2026 in New York. They are an hour apart, despite looking identical when the display omits an offset. This executable check uses only `Intl.DateTimeFormat`.

```javascript
export function formatMeeting(instant, timeZone, locale = 'en-GB') {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(instant));
}

const first = '2026-11-01T05:30:00Z';
const second = '2026-11-01T06:30:00Z';
const zone = 'America/New_York';
console.assert(formatMeeting(first, zone) === formatMeeting(second, zone));
console.assert(new Date(first).getTime() !== new Date(second).getTime());
```

When a requested local time occurs twice, confirmation must distinguish the earlier and later occurrence and show their offsets. During a spring transition, some local times do not occur at all. Silently moving a nonexistent 02:30 to 03:30 changes the appointment. Reject it for correction or offer an explicit adjustment policy; do not make that decision invisible.

## A local form value does not contain a regional zone

A `datetime-local` field expresses calendar and clock values. It does not select the relevant regional time zone. Feeding that string into parsing logic tied to the device's zone produces different instants on different machines. Send explicit local fields, a zone, and a disambiguation choice to one authoritative resolution boundary, then return an instant the user can confirm.

If validation fails, preserve the entered fields while the user chooses a resolution. A user traveling from Shanghai to Tokyo should not change a New York appointment's meaning. Viewer-local time can be an additional display. Editing must also distinguish changing the display zone from moving the meeting to nine o'clock in another zone.

## Persist recurrence rules, not only the next occurrence

A weekly local-time schedule needs weekday, clock time, zone, and gap/overlap policies. Advance the calendar and then resolve the next occurrence under that zone. Adding seven days in milliseconds to the previous UTC value preserves an elapsed duration instead. Monitoring jobs may want precisely that duration model; meetings often do not.

Time-zone database updates may change future resolutions. Retain a rule version or resolution record where required, recompute pending occurrences under an explicit policy, and explain affected changes to users. Completed audit facts should remain facts. If an integration accepts only UTC, label an exported instant as one expanded occurrence rather than treating it as a complete recurrence rule.

## Test boundary behavior instead of just formatting examples

Cover overlapping times, missing times, year boundaries, half-hour offset regions, device-zone changes, and disagreement between client and server rule data. Assert both the resolved instant and the date and clock time shown when it is reopened. For all-day events, confirm that viewing from another region does not move the date backward.

State whether the API preserves local nine o'clock or a fixed interval in both its contract and its user-facing wording. That decision prevents an ordinary appointment edit from turning into a mysterious data issue at the next clock transition.
