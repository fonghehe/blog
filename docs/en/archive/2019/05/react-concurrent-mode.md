---
title: "A First Look at React Concurrent Mode"
date: 2019-05-27 16:57:55
tags:
  - React
readingTime: 1
description: "The React team revealed more details about Concurrent Mode at React Conf 2019. This is the most important feature since React 16.8 Hooks, but the stable release"
wordCount: 95
---

The React team revealed more details about Concurrent Mode at React Conf 2019. This is the most important feature since React 16.8 Hooks, but the stable release may not arrive until 2020.

## What Problem Does Concurrent Mode Solve

The problem with synchronous rendering: once React starts rendering, it cannot be interrupted. Rendering a large component tree blocks the main thread and makes user interactions unresponsive.

```javascript
// Traditional synchronous rendering
// Start rendering → rendering complete (no user interaction in between)
ReactDOM.render(<App />, document.getElementById("root"));

// Concurrent Mode: rendering can be interrupted
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
// Rendering can respond to user input, high-priority tasks can interrupt low-priority rendering
```

## Suspense: Making Data Fetching Asynchronous

```jsx
// Previous loading pattern (each component manages its own loading state)
function UserProfile({ id }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(id).then((user) => {
      setUser(user);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Spinner />;
  return <div>{user.name}</div>;
}

// Suspense pattern (component only cares about data, loading is handled at parent level)
function UserProfile({ id }) {
  const user = userResource.read(id); // throws a Promise if not ready
  return <div>{user.name}</div>;
}

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile id="123" />
    </Suspense>
  );
}
```

## useTransition: Distinguishing Urgent from Non-Urgent Updates

```jsx
import { useState, useTransition } from "react";

function SearchResults() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    // Urgent update: show the typed character immediately
    setQuery(e.target.value);

    // Non-urgent update: search results can be interrupted
    startTransition(() => {
      const searchResults = performExpensiveSearch(e.target.value);
      setResults(searchResults);
    });
  }

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending ? <span>Searching...</span> : null}
      <ul>
        {results.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

Concurrent Mode represents a fundamental shift in how React thinks about rendering — prioritizing user responsiveness over rendering completeness.
