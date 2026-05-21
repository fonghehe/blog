---
title: "ES2017 async/await Best Practices"
date: 2018-01-13 09:34:55
tags:
  - JavaScript
readingTime: 2
description: "async/await became part of the ES2017 standard. Node.js 7.6+ supports it natively, and with Babel it works in frontend projects too. After half a year of real u"
wordCount: 143
---

async/await became part of the ES2017 standard. Node.js 7.6+ supports it natively, and with Babel it works in frontend projects too. After half a year of real usage, here are the lessons learned.

## Quick Review

```javascript
// Promise chain
function fetchUserData(userId) {
  return fetch(`/api/users/${userId}`)
    .then((res) => res.json())
    .then((user) => fetch(`/api/orders?userId=${user.id}`))
    .then((res) => res.json())
    .catch((err) => console.error(err));
}

// async/await rewrite
async function fetchUserData(userId) {
  const userRes = await fetch(`/api/users/${userId}`);
  const user = await userRes.json();
  const ordersRes = await fetch(`/api/orders?userId=${user.id}`);
  const orders = await ordersRes.json();
  return { user, orders };
}
```

async/await is syntactic sugar over Promises, but readability improves dramatically, especially for deeply nested async logic.

## Error Handling: Don't Overuse try/catch

The most common anti-pattern is wrapping every await in its own try/catch:

```javascript
// Anti-pattern: too much noise
async function loadPage() {
  try {
    const user = await getUser();
  } catch (e) {
    console.error(e);
  }

  try {
    const posts = await getPosts();
  } catch (e) {
    console.error(e);
  }
}
```

Better: decide error handling granularity based on business needs:

```javascript
// Option 1: unified handling, abort on any failure
async function loadPage() {
  try {
    const user = await getUser();
    const posts = await getPosts(user.id);
    return { user, posts };
  } catch (err) {
    handleError(err);
  }
}

// Option 2: to() helper, Go-style error handling
const to = (promise) =>
  promise.then((data) => [null, data]).catch((err) => [err, null]);

async function loadPage() {
  const [userErr, user] = await to(getUser());
  if (userErr) {
    return renderGuestPage();
  }

  const [postsErr, posts] = await to(getPosts(user.id));
  if (postsErr) {
    return renderPage(user, []);
  }

  return renderPage(user, posts);
}
```

## Parallel Requests: Don't Let await Serialize

This is the most common performance pitfall:

```javascript
// Slow: serial execution, total time = A + B
async function loadDashboard() {
  const users = await fetchUsers(); // waits 200ms
  const orders = await fetchOrders(); // then waits 300ms
  // Total: 500ms
}

// Fast: parallel execution, total time = max(A, B)
async function loadDashboard() {
  const [users, orders] = await Promise.all([fetchUsers(), fetchOrders()]);
  // Total: 300ms
}
```

Only serialize when the second request depends on the first result. Otherwise prefer `Promise.all`.

## async/await in Loops

```javascript
const userIds = [1, 2, 3, 4, 5];

// Wrong: forEach doesn't wait for async callbacks
userIds.forEach(async (id) => {
  await processUser(id); // forEach won't wait here
});

// Serial: one at a time (good for ordered processing)
for (const id of userIds) {
  await processUser(id);
}

// Parallel: fire all at once (good for independent tasks)
await Promise.all(userIds.map((id) => processUser(id)));

// Batch with concurrency limit
async function processInBatches(items, batchSize) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => processItem(item)));
  }
}
```

## Using in Vue/React Components

```javascript
// Vue component
export default {
  data() {
    return {
      loading: false,
      error: null,
      posts: [],
    };
  },
  async created() {
    this.loading = true;
    try {
      this.posts = await fetchPosts();
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  },
};
```

```javascript
// React component
class PostList extends React.Component {
  state = { loading: false, posts: [], error: null };

  async componentDidMount() {
    this.setState({ loading: true });
    try {
      const posts = await fetchPosts();
      this.setState({ posts, loading: false });
    } catch (error) {
      this.setState({ error: error.message, loading: false });
    }
  }
}
```

Note: the component may be unmounted before the async operation completes — you'll need to handle "don't setState after unmount", but that's a separate topic.

## Babel Configuration

To use async/await in browsers:

```bash
npm install --save-dev @babel/preset-env
```

```json
// babel.config.js
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "useBuiltIns": "usage",
        "corejs": 3
      }
    ]
  ]
}
```
