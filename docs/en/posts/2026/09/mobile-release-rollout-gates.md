---
title: "Mobile Release Gates: Binaries, Updates, and Rollback"
date: 2026-09-25 18:39:12
tags:
  - Mobile
description: "Check runtime compatibility, staged rollout metrics, and recovery paths for React Native and Flutter apps."
readingTime: 2
wordCount: 458
---

Unlike a website, a mobile app is not upgraded for every user at once. New servers, old binaries, cached local data, and possibly JS updates coexist. Release gates must cover those combinations, not just whether CI can produce a binary.

## Define what each delivery channel can change

Native dependencies, permissions, and platform configuration require a new binary. An update mechanism can change only code compatible with its installed runtime. Record app version, build number, runtime identifier, backend compatibility range, and local migration version. Prefer additive server fields; remove fields only after observing old-client usage.

## Roll out against business outcomes

Before expanding distribution, check install, startup, login, key transactions, and notification landing. Crash-free rate alone misses an app that opens but cannot place an order. Correlate error rates, timeouts, sync backlog, and completed orders with app versions; define a pause threshold in advance.

If a server feature flag causes the issue, turn it off first. If a local database migration is irreversible, reverting the binary may not restore data; plan a forward repair. A release record should state who is affected, how to reproduce, which layer to roll back, and how to confirm recovery.

## Design a rollout for a payment-flow change

Suppose a release changes the payment confirmation screen, local client state, and a server request field. Before shipping, write a compatibility matrix: can an old client pay against the new server, what does a new client do against the old server, and what survives a failed update? Make the server accept the new field before releasing clients; remove old fields only after older clients leave the supported range. For remotely delivered JS assets or configuration, also follow the relevant platform and store rules and check compatibility between the native binary and asset version.

Advance through observable gates: internal devices, a small real-user cohort, then gradual expansion. At each gate record sample size, payment completion, crashes and ANRs, key-screen errors, and API rejection rate. Choose thresholds from the product's baseline and traffic; one universal percentage cannot fit every app. With little traffic, “zero crashes” is weak evidence, so add manual regression, synthetic transactions, or a longer observation window.

```text
Internal → small cohort → compare same-version/region baseline → expand
                           ↘ gate fails: stop expansion and roll back what can roll back
```

## Say exactly what rolls back

A server feature flag may close the new entry point, and remote assets may roll back to a version compatible with the installed binary. A native binary distributed through an app store generally cannot be replaced instantly. If data has already migrated or users have submitted a new format, verify that old code can still read it before reverting. The release record should name an owner, dashboards, stop conditions, and rollback commands. Rehearse disabling the flag, restoring the compatible server path, and handling orders already created. See [Expo EAS Update deployment](https://docs.expo.dev/eas-update/deployment/).

See [Expo EAS Update deployment](https://docs.expo.dev/eas-update/deployment/).
