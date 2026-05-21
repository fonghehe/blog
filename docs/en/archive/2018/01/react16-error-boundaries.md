---
title: "React 16 Error Boundaries: Goodbye White Screen Crashes"
date: 2018-01-09 11:00:56
tags:
  - React
readingTime: 2
description: "In React 15, an unhandled JavaScript error in a component would corrupt the entire application state and lead to cryptic errors or a completely white screen. Re"
wordCount: 193
---

In React 15, an unhandled JavaScript error in a component would corrupt the entire application state and lead to cryptic errors or a completely white screen. React 16 introduced **Error Boundaries** to contain errors to a component subtree.

## The Problem with React 15

```javascript
// React 15: this error crashes the entire app
function BrokenComponent() {
  throw new Error("Something went wrong!");
  return <div>This will never render</div>;
}
```

## Implementing an Error Boundary

An Error Boundary is a class component that implements `componentDidCatch` (and/or `getDerivedStateFromError`):

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // React 16+: update state to show fallback UI
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // For logging to an error reporting service
  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    // errorInfo.componentStack shows the component tree
    logErrorToService(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong.</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## Using Error Boundaries

```jsx
function App() {
  return (
    <ErrorBoundary>
      <Header />
      <ErrorBoundary fallback={<div>Widget failed to load</div>}>
        <DangerousWidget />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  );
}
```

## Granularity Design

The key question is where to place error boundaries.

**Page-level** (coarse):

```jsx
// Entire page protected by one boundary
<ErrorBoundary>
  <UserDashboard />
</ErrorBoundary>
```

**Component-level** (fine):

```jsx
// Independent widgets have their own boundaries
<div>
  <ErrorBoundary>
    <RecommendationWidget />
  </ErrorBoundary>
  <ErrorBoundary>
    <CommentSection />
  </ErrorBoundary>
</div>
```

Recommendation: use page-level boundaries as a safety net, and add component-level boundaries for independently-failable widgets.

## What Error Boundaries Do NOT Catch

Error boundaries only catch errors in **render methods and lifecycle methods**. They do NOT catch:

- Event handler errors (use regular try/catch)
- Async errors (`setTimeout`, Promises)
- Server-side rendering errors
- Errors in the error boundary itself

```javascript
// Event handler: use try/catch, not error boundaries
handleClick = () => {
  try {
    doSomethingRisky();
  } catch (error) {
    this.setState({ error: error.message });
  }
};
```

## React 16 New Behavior

React 16 changed a critical behavior: **if an error is not caught by any error boundary, the entire component tree is unmounted**. Previously, React would leave the broken UI in place.

The reason for this change: a corrupted UI is more dangerous than an empty screen. An unmounted tree makes the error visible and forces handling it.
