---
title: "React Context Performance Optimization Guide"
date: 2019-05-13 10:48:53
tags:
  - React
readingTime: 1
description: "React 16.3 introduced the new Context API, and 16.8 Hooks made it even more ergonomic. But in real projects, many people find that using Context causes frequent"
wordCount: 148
---

React 16.3 introduced the new Context API, and 16.8 Hooks made it even more ergonomic. But in real projects, many people find that using Context causes frequent component re-renders and performance degradation. This article dives deep into Context's rendering mechanics and optimization strategies.

## The Re-render Problem with Context

Let's look at a classic "falling into the trap" example:

```jsx
{% raw %}
import React, { createContext, useState } from 'react'

const UserContext = createContext()

function App() {
  const [user, setUser] = useState({ name: 'Alice', age: 25 })
  const [theme, setTheme] = useState('light')

  console.log('App render')

  return (
    <UserContext.Provider value={{ user, setUser, theme, setTheme }}>
      <UserProfile />
      <ThemeSwitcher />
    </UserContext.Provider>
  )
}

function UserProfile() {
  console.log('UserProfile render')
  const { user } = useContext(UserContext)
  return <div>Username: {user.name}</div>
}

function ThemeSwitcher() {
  console.log('ThemeSwitcher render')
  const { theme, setTheme } = useContext(UserContext)
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      Current theme: {theme}
    </button>
  )
}
{% endraw %}
```

The problem: clicking to switch theme causes `UserProfile` to re-render, even though it only cares about `user`. Because `ThemeSwitcher` calls `setTheme`, the `value` object changes, causing all `useContext(UserContext)` consumers to re-render.

**Core principle: when Context.Provider's value changes, all components using that Context will re-render, regardless of which fields they actually use.**

## Solution 1: Split the Context

The most straightforward approach: put different concerns in separate contexts.

```jsx
import React, { createContext, useState, useContext } from "react";

// Split by concern
const UserContext = createContext();
const ThemeContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState({ name: "Alice", age: 25 });
  const [theme, setTheme] = useState("light");

  const userValue = { user, setUser };
  const themeValue = { theme, setTheme };

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

## Solution 2: Memoize with useMemo

```jsx
function AppProvider({ children }) {
  const [user, setUser] = useState({ name: "Alice", age: 25 });
  const [theme, setTheme] = useState("light");

  // Memoize the value object so it only changes when the actual data changes
  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

Splitting contexts by concern is the most effective strategy — it also makes your code more modular and maintainable.
