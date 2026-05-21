---
title: "The Complete Guide to useEffect: The Dependency Array Pitfall"
date: 2019-03-10 10:47:44
tags:
  - Frontend
readingTime: 1
description: "After using React Hooks for a month, I found that `useEffect` is the easiest place to get burned. The dependency array especially will lead to bugs if you don't"
wordCount: 85
---

After using React Hooks for a month, I found that `useEffect` is the easiest place to get burned. The dependency array especially will lead to bugs if you don't understand the underlying principles.

## Start with the Mental Model

`useEffect` is essentially about "synchronization" — keeping side effects in sync with React rendering.

```javascript
// Mental model:
// After each render, React checks whether dependencies have changed
// If they have, it first runs the previous cleanup function, then runs the new effect

function MyComponent({ id }) {
  useEffect(() => {
    console.log("effect ran, id =", id);
    return () => {
      console.log("cleanup, id =", id); // the previous id
    };
  }, [id]);
}

// Render id=1 → effect runs (id=1)
// Render id=2 → cleanup (id=1) → effect runs (id=2)
// Unmount    → cleanup (id=2)
```

## Common Mistake 1: Missing Dependencies

```javascript
// ❌ Wrong: missing the userId dependency
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // [] means run once, but won't re-fetch when userId changes!

  return <div>{user?.name}</div>;
}

// ✅ Correct: declare all dependencies
useEffect(() => {
  fetchUser(userId).then(setUser);
}, [userId]); // re-fetches when userId changes
```

After installing `eslint-plugin-react-hooks`, the `exhaustive-deps` rule will automatically warn about missing dependencies.

## Common Mistake 2: Infinite Loops

```javascript
// ❌ Modifying a state that is also a dependency inside the effect
function ProblematicComponent() {
  const [data, setData] = useState([]);

  useEffect(() => {
    processData(data); // reads data
    setData([...data, newItem]); // modifies data
  }, [data]); // data changes → reruns → data changes again → infinite loop!
}

// ✅ Use a ref or functional update
function FixedComponent() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((c) => c + 1); // functional update, no dependency on count
    }, 1000);
    return () => clearInterval(timer);
  }, []); // [] is valid because we no longer depend on count
}
```

## useCallback and useMemo

When effects depend on functions, problems easily arise:

```javascript
// ❌ Creates a new fetchUser function reference on every render
function Parent({ userId }) {
  const fetchUser = () => fetch(`/api/user/${userId}`); // new on every render

  useEffect(() => {
    fetchUser();
  }, [fetchUser]); // runs on every render!
}

// ✅ useCallback caches the function reference
function Parent({ userId }) {
  const fetchUser = useCallback(() => {
    return fetch(`/api/user/${userId}`);
  }, [userId]); // only creates a new function when userId changes

  useEffect(() => {
    fetchUser();
  }, [fetchUser]); // fetchUser is stable, no infinite execution
}
```

```javascript
// useMemo: cache computed results (avoid recalculating on every render)
function ProductList({ products, category }) {
  // Only re-filters when products or category changes
  const filtered = useMemo(
    () => products.filter((p) => p.category === category),
    [products, category],
  );

  return (
    <ul>
      {filtered.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
```
