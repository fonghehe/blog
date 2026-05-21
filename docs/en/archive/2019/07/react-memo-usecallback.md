---
title: "React.memo and useCallback Performance Optimization — When to Use Them"
date: 2019-07-15 10:56:35
tags:
  - React
readingTime: 2
description: "React 16.6 introduced `React.memo`, and together with `useCallback` and `useMemo` from Hooks, developers have more performance optimization tools. However, in r"
wordCount: 223
---

React 16.6 introduced `React.memo`, and together with `useCallback` and `useMemo` from Hooks, developers have more performance optimization tools. However, in real projects I've found that many people (including my past self) fall into the trap of "wrapping everything in memo." This article covers the correct usage of these APIs.

## React.memo Basics

`React.memo` is a higher-order component similar to `PureComponent`, but for function components. It does a shallow comparison of props and skips re-rendering if props haven't changed.

```jsx
// Without memo: child re-renders every time parent renders
function UserCard({ user }) {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

// With memo: only re-renders when props change
const UserCard = React.memo(function UserCard({ user }) {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
});
```

## The Problem: Reference Stability

```jsx
function UserList() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");

  // New function reference on every render!
  const handleClick = (id) => {
    console.log("clicked", id);
  };

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          onClick={handleClick} // New function every time!
        />
      ))}
    </div>
  );
}

const UserCard = React.memo(function UserCard({ user, onClick }) {
  return <div onClick={() => onClick(user.id)}>{user.name}</div>;
});
```

Think `React.memo` prevents `UserCard` from re-rendering? It won't — because `handleClick` is a new function reference on every render, `React.memo`'s shallow comparison will detect a prop change and re-render.

## useCallback to the Rescue

```jsx
function UserList() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");

  // Stable function reference
  const handleClick = useCallback((id) => {
    console.log("clicked", id);
  }, []); // Empty deps: function never changes

  const handleDelete = useCallback((id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []); // setUsers is stable, no need to include

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      {users
        .filter((u) => u.name.includes(filter))
        .map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onClick={handleClick}
            onDelete={handleDelete}
          />
        ))}
    </div>
  );
}
```

## Real Case: Order List Optimization

Our project had an order list page rendering 200 rows of data, lagging whenever the search input changed:

```jsx
// After optimization: add useCallback
function OrderList() {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");

  const handleSort = useCallback((field) => {
    setSortBy(field);
  }, []);

  const handleStatusChange = useCallback((id, status) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }, []);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      if (sortBy === "date") return new Date(b.date) - new Date(a.date);
      if (sortBy === "amount") return b.amount - a.amount;
      return 0;
    });
  }, [orders, sortBy]);

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter(
      (o) => o.id.includes(search) || o.customer.includes(search),
    );
  }, [sortedOrders, search]);

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      {filteredOrders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  );
}

const OrderRow = React.memo(function OrderRow({ order, onStatusChange }) {
  return (
    <div className="order-row">
      <span>{order.id}</span>
      <span>{order.customer}</span>
      <span>{order.amount}</span>
      <select
        value={order.status}
        onChange={(e) => onStatusChange(order.id, e.target.value)}
      >
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="completed">Completed</option>
      </select>
    </div>
  );
});
```

## When NOT to Use These Hooks

Don't blindly wrap everything with `memo`/`useCallback`/`useMemo`:

1. **Simple components** — The comparison overhead may exceed the rendering cost
2. **Components that almost always re-render** — Memo adds overhead without benefit
3. **Primitive props** — Primitives are compared by value; no stability issues

## Summary

- `React.memo` skips re-renders when props don't change (shallow comparison)
- `useCallback` stabilizes function references, paired with `React.memo` to prevent unnecessary child re-renders
- `useMemo` caches expensive computations
- Profile first with React DevTools Profiler before optimizing — don't optimize prematurely
