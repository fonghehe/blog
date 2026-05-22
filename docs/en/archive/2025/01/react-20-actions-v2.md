---
title: "React 20 Actions v2 Enhancements"
date: 2025-01-03 11:57:34
tags:
  - React
readingTime: 2
description: "The Actions mechanism in React 20 receives a major upgrade. v1 Actions mainly addressed form submission scenarios; v2 extends them into a general-purpose async "
wordCount: 241
---

The Actions mechanism in React 20 receives a major upgrade. v1 Actions mainly addressed form submission scenarios; v2 extends them into a general-purpose async operation primitive covering optimistic updates, error boundary integration, and transactional state management.

## useActionState Redesigned

The v2 `useActionState` is no longer limited to form actions — it can now wrap any async function, with built-in pending state, optimistic updates, and automatic error recovery.

```javascript
import { useActionState } from "react";

function CommentSection({ postId }) {
  const [comments, addComment, isPending] = useActionState(
    async (prevComments, formData) => {
      const text = formData.get("comment");
      const newComment = await api.addComment(postId, { text });
      return [...prevComments, newComment];
    },
    initialComments,
    {
      optimisticUpdate: (prevComments, formData) => {
        return [
          ...prevComments,
          {
            id: `temp-${Date.now()}`,
            text: formData.get("comment"),
            optimistic: true,
          },
        ];
      },
    },
  );

  return (
    <div>
      {comments.map((c) => (
        <Comment key={c.id} comment={c} isOptimistic={c.optimistic} />
      ))}
      <form action={addComment}>
        <textarea name="comment" required />
        <button disabled={isPending}>
          {isPending ? "发送中..." : "发表评论"}
        </button>
      </form>
    </div>
  );
}
```

The key change is the `optimisticUpdate` option — it makes optimistic updates declarative, eliminating the need to manually manage `useOptimistic` state rollbacks.

## useAction: Actions for Non-Form Scenarios

`useAction` is a new hook in v2 for non-form-triggered async operations such as button clicks, drag-and-drop, and scheduled tasks.

```javascript
import { useAction } from "react";

function FileUploader() {
  const { execute, isPending, error, data } = useAction(
    async (file) => {
      const presignedUrl = await api.getUploadUrl(file.name);
      await fetch(presignedUrl, {
        method: "PUT",
        body: file,
      });
      return api.confirmUpload(file.name);
    },
    {
      onSuccess: (result) => toast.success(`上传成功: ${result.name}`),
      onError: (err) => toast.error(err.message),
      retry: { count: 3, delay: 1000 },
    },
  );

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) execute(file);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ opacity: isPending ? 0.6 : 1 }}
    >
      {isPending ? "上传中..." : "拖拽文件到此处"}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

The built-in retry mechanism is a standout feature — the `retry` config supports exponential backoff, which is particularly useful on mobile devices with weak network connectivity.

## Deep Integration of Actions and Suspense

v2 Actions can directly drive Suspense boundaries, enabling a true "loading state as UI" pattern:

```javascript
function OrderDashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <OrderStats />
      <Suspense fallback={<TableSkeleton />}>
        <OrderList />
      </Suspense>
    </Suspense>
  );
}

function OrderList() {
  const orders = use(api.getOrders()); // Read directly during render

  const [filtered, filterAction, isPending] = useActionState(
    async (prev, formData) => {
      const status = formData.get("status");
      return api.getOrders({ status });
    },
    orders,
  );

  return (
    <div style={{ transition: isPending ? "opacity 150ms" : undefined }}>
      <form action={filterAction}>
        <select name="status">
          <option value="all">全部</option>
          <option value="pending">待处理</option>
          <option value="shipped">已发货</option>
        </select>
      </form>
      <Table data={filtered} />
    </div>
  );
}
```

The `transition` combined with `isPending` gives filter operations a graceful fade effect without content flickering.

## Summary

- `useActionState` adds an `optimisticUpdate` option, making optimistic updates declarative
- `useAction` hook covers non-form async scenarios with built-in retry and lifecycle callbacks
- Actions deeply integrate with Suspense; pending state naturally drives UI transitions
- Error recovery is smarter — automatically rolling back optimistic state on failure
- Actions have become the standard paradigm for async operations in React; recommended as a replacement for the traditional `useEffect` + `fetch` pattern
