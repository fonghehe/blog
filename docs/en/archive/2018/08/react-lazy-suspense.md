---
title: "React 16.6: First Look at lazy/Suspense"
date: 2018-08-16 09:53:24
tags:
  - React
readingTime: 2
description: "React 16.6 ships `React.lazy` and `Suspense`, making component lazy loading extremely simple."
wordCount: 119
---

React 16.6 ships `React.lazy` and `Suspense`, making component lazy loading extremely simple.

## Lazy Loading Before 16.6

Before 16.6, the usual approach was the `react-loadable` library:

```javascript
import Loadable from "react-loadable";

const Dashboard = Loadable({
  loader: () => import("./Dashboard"),
  loading: () => <div>Loading...</div>,
});
```

## React.lazy + Suspense

```javascript
import React, { lazy, Suspense } from "react";

// lazy accepts a function that returns a dynamic import
const Dashboard = lazy(() => import("./Dashboard"));
const Settings = lazy(() => import("./Settings"));

function App() {
  return (
    // Suspense specifies the fallback UI shown while loading
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
```

A `lazy`-wrapped component only loads the corresponding JS file on its first render.

## Route-Level Lazy Loading

```javascript
import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";

const Home = lazy(() => import("./routes/Home"));
const About = lazy(() => import("./routes/About"));
const Users = lazy(() => import("./routes/Users"));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="page-loader">Loading...</div>}>
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/about" component={About} />
          <Route path="/users" component={Users} />
        </Switch>
      </Suspense>
    </Router>
  );
}
```

## Suspense Loading State

```jsx
{% raw %}
// A better Loading component
function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <Spinner />
    </div>
  );
}

// Suspense can be nested
function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Header />
      <Suspense fallback={<ContentLoader />}>
        <MainContent />
      </Suspense>
      <Footer />
    </Suspense>
  );
}
{% endraw %}
```

## Using with Error Boundaries

When a lazy component fails to load, an error boundary is needed to catch the error:

```javascript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>Component failed to load</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <LazyComponent />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Current Limitations

In version 16.6, `Suspense` only supports `lazy` loading. Other data-fetching scenarios (such as waiting for API responses) are still under development as part of Concurrent Mode.

The React team plans to extend Suspense to data fetching, enabling something like:

```jsx
// Possible future syntax (not yet stable)
function UserList() {
  const users = fetchUsers.read(); // If not yet loaded, Suspense handles it automatically
  return (
    <ul>
      {users.map((u) => (
        <li>{u.name}</li>
      ))}
    </ul>
  );
}
```

## vs Vue's Async Components

A comparison with Vue's lazy loading approach:

```javascript
// Vue: route lazy loading
const Dashboard = () => import("./Dashboard.vue");

// Vue: advanced async component (with loading and error states)
const AsyncComp = () => ({
  component: import("./Dashboard.vue"),
  loading: LoadingComponent,
  error: ErrorComponent,
  delay: 200,
  timeout: 8000,
});

// React: lazy + Suspense (more standardized API)
const Dashboard = lazy(() => import("./Dashboard"));
// fallback is managed centrally through Suspense, not configured per component
```
