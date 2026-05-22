---
title: "React 20 Suspense Improvements"
date: 2025-01-16 09:10:47
tags:
  - React
readingTime: 3
description: "React 20's Suspense has undergone its biggest iteration since version 18. The new SuspenseList component, streaming SSR improvements, and deep integration with "
wordCount: 357
---

React 20's Suspense has undergone its biggest iteration since version 18. The new SuspenseList component, streaming SSR improvements, and deep integration with Actions have evolved Suspense from "loading placeholder" to "data fetching orchestration."

## SuspenseList: Controlling Load Order

SuspenseList solves the visual chaos that occurs when multiple async components load simultaneously — you can control the order in which they appear.

```javascript
import { Suspense, SuspenseList } from "react";

function Dashboard() {
  return (
    <SuspenseList revealOrder="forwards" tail="collapsed">
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <UserGrowthChart />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <ConversionChart />
      </Suspense>
    </SuspenseList>
  );
}
```

`revealOrder` values:

- `"forwards"`: reveal in order — if an earlier item hasn't loaded, later ones don't show
- `"backwards"`: reverse order
- `"together"`: all reveal simultaneously once all are loaded
- `undefined`: whoever is ready first shows first (default behavior)

`tail="collapsed"` means components that haven't had their turn yet don't show a fallback, avoiding the visual noise of a row of skeletons.

```javascript
// Real-world scenario: chat message list
function ChatMessages({ messages }) {
  return (
    <SuspenseList revealOrder="forwards" tail={3}>
      {messages.map((msg) => (
        <Suspense key={msg.id} fallback={<MessageSkeleton />}>
          <MessageRenderer id={msg.id} />
        </Suspense>
      ))}
    </SuspenseList>
  );
}
// tail={3} means at most 3 fallback skeletons are shown
// Items beyond that are completely hidden, avoiding page flicker
```

## useSuspenseQuery: A New Data Fetching Paradigm

React 20 combines the `use` hook with Suspense to introduce `useSuspenseQuery`, replacing the traditional `useEffect` + fetch pattern.

```javascript
import { useSuspenseQuery } from "@tanstack/react-query";
// Can also use React's built-in
import { use, Suspense } from "react";

// Option 1: React Query integration
function UserProfile({ userId }) {
  const { data: user } = useSuspenseQuery({
    queryKey: ["user", userId],
    queryFn: () => api.getUser(userId),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <Avatar src={user.avatar} />
      <h2>{user.name}</h2>
      <p>{user.bio}</p>
    </div>
  );
}

// Option 2: React native use hook
function UserProfileNative({ userPromise }) {
  const user = use(userPromise); // automatically triggers Suspense

  return (
    <div>
      <Avatar src={user.avatar} />
      <h2>{user.name}</h2>
    </div>
  );
}

// Usage
function App({ params }) {
  const userPromise = api.getUser(params.id); // initiated in a Server Component

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfileNative userPromise={userPromise} />
    </Suspense>
  );
}
```

The key distinction: the `use` hook accepts a Promise as its argument and will suspend during component rendering (rather than setting state asynchronously in an effect). This unifies data fetching and rendering.

## Selective Hydration Improvements in Streaming SSR

React 20's streaming SSR now supports selective hydration — interactive components are hydrated first, while others are deferred.

```javascript
// app/layout.tsx (Next.js 16)
import { Suspense } from "react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <header>
          <Navigation /> {/* Interactive component, hydrated first */}
        </header>
        <main>{children}</main>
        <footer>
          <Suspense fallback={null}>
            <AnalyticsWidget />{" "}
            {/* Deferred hydration, doesn't affect first screen */}
          </Suspense>
        </footer>
      </body>
    </html>
  );
}
```

When a user clicks the navigation, React will prioritize hydrating the `<Navigation>` component even if other parts of the page haven't finished hydrating. This significantly improves TTI (Time to Interactive).

## Nested Suspense Fallback Strategy

React 20 allows Suspense boundaries to specify a delay before showing the fallback, avoiding flicker in fast-loading scenarios:

```javascript
function App() {
  return (
    <Suspense
      fallback={<PageSkeleton />}
      // Delay showing the fallback by 200ms; if it loads within 200ms, don't show it at all
      unstable_avoidFallback={true}
      unstable_expectedLoadTime={200}
    >
      <Suspense fallback={<SectionSkeleton />} unstable_expectedLoadTime={50}>
        <SlowDataComponent />
      </Suspense>
      <FastComponent />
    </Suspense>
  );
}
```

`unstable_expectedLoadTime` gives React a hint about roughly how long the content inside this boundary will take to load. React uses this hint to decide whether to show the fallback — if the expected load time is short, it maintains the previous state without flashing.

## Summary

- SuspenseList controls the reveal order of multiple async components, solving visual chaos
- The `use` hook unifies data fetching and rendering, completely replacing `useEffect` + fetch
- Selective Hydration in streaming SSR greatly improves TTI; interactive components hydrate first
- Suspense boundaries support delayed fallbacks, preventing UI flicker in fast-loading scenarios
- Suspense has evolved from "loading placeholder" into a complete data fetching orchestration solution
