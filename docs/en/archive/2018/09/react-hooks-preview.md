---
title: "React Hooks Preview: First Look at useState and useEffect"
date: 2018-09-12 17:05:13
tags:
  - React
readingTime: 2
description: "The React team proposed the Hooks RFC last month. I tried it out yesterday and it feels like one of the biggest changes in the React ecosystem."
---

The React team proposed the Hooks RFC last month. I tried it out yesterday and it feels like one of the biggest changes in the React ecosystem.

> **Note**: React Hooks is still in RFC stage as of September 2018, and the API may still change. It's expected to be available in React 16.7 alpha.

## Problems Hooks Solves

Before Hooks, there were several long-standing pain points:

1. **Logic reuse is hard**: Sharing stateful logic between components requires HOCs or render props, leading to deep nesting
2. **Complex components are hard to understand**: Lifecycle methods scatter related logic (e.g., subscription and unsubscription split across componentDidMount and componentWillUnmount)
3. **`this` in classes is confusing**: Beginners often forget to bind `this`

Hooks let function components have state and side effects.

## useState: The State Hook

```javascript
import React, { useState } from "react";

// Before: needed a class
class Counter extends React.Component {
  state = { count: 0 };

  render() {
    return (
      <button onClick={() => this.setState({ count: this.state.count + 1 })}>
        Count: {this.state.count}
      </button>
    );
  }
}

// With Hooks: function components can have state
function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

`useState` returns `[currentValue, updaterFunction]` — destructure to receive them.

```javascript
// Multiple state values
function UserForm() {
  const [name, setName] = useState("");
  const [age, setAge] = useState(0);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await saveUser({ name, age });
    setLoading(false);
  }

  return (
    <form onSubmit={submit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={age} onChange={(e) => setAge(Number(e.target.value))} />
      <button disabled={loading}>{loading ? "Saving..." : "Save"}</button>
    </form>
  );
}
```

## useEffect: The Side Effect Hook

```javascript
import React, { useState, useEffect } from "react";

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // useEffect runs after render — equivalent to componentDidMount + componentDidUpdate
  useEffect(() => {
    setLoading(true);

    fetchUser(userId).then((data) => {
      setUser(data);
      setLoading(false);
    });

    // The returned function is called before the next effect or on unmount
    // Equivalent to componentWillUnmount
    return () => {
      // Cleanup: cancel requests, clear subscriptions, etc.
    };
  }, [userId]); // Dependency array: re-run only when userId changes

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return <div>{user.name}</div>;
}
```

**Dependency array rules:**

```javascript
useEffect(() => {
  // Runs after every render
});

useEffect(() => {
  // Runs only on mount (equivalent to componentDidMount)
}, []);

useEffect(() => {
  // Runs when userId or type changes
}, [userId, type]);
```

## Custom Hooks: Logic Reuse

This is the most powerful aspect of Hooks — extracting stateful logic into reusable functions:

```javascript
// Custom Hook: encapsulate data fetching logic
function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}

// Reuse across multiple components
function UserProfile({ userId }) {
  const { user, loading } = useUser(userId);
  if (loading) return <Spinner />;
  return <div>{user.name}</div>;
}

function UserAvatar({ userId }) {
  const { user } = useUser(userId);
  return <img src={user?.avatar} alt={user?.name} />;
}
```

Much cleaner than HOC nesting or render props!
