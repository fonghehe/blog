---
title: "React 20 Actions v2 增强"
date: 2025-01-03 10:00:00
tags:
  - React
readingTime: 2
description: "React 20 中的 Actions 机制迎来重大升级。v1 版本的 Actions 主要解决了表单提交场景，v2 则将其扩展为通用的异步操作原语，覆盖了乐观更新、错误边界集成和事务性状态管理。"
---

React 20 中的 Actions 机制迎来重大升级。v1 版本的 Actions 主要解决了表单提交场景，v2 则将其扩展为通用的异步操作原语，覆盖了乐观更新、错误边界集成和事务性状态管理。

## useActionState 重新设计

v2 的 `useActionState` 不再局限于 form action，现在可以包裹任何异步函数，并且内置了 pending 状态、乐观更新和自动错误恢复。

```javascript
import { useActionState } from 'react';

function CommentSection({ postId }) {
  const [comments, addComment, isPending] = useActionState(
    async (prevComments, formData) => {
      const text = formData.get('comment');
      const newComment = await api.addComment(postId, { text });
      return [...prevComments, newComment];
    },
    initialComments,
    {
      optimisticUpdate: (prevComments, formData) => {
        return [...prevComments, {
          id: `temp-${Date.now()}`,
          text: formData.get('comment'),
          optimistic: true,
        }];
      },
    }
  );

  return (
    <div>
      {comments.map(c => (
        <Comment
          key={c.id}
          comment={c}
          isOptimistic={c.optimistic}
        />
      ))}
      <form action={addComment}>
        <textarea name="comment" required />
        <button disabled={isPending}>
          {isPending ? '发送中...' : '发表评论'}
        </button>
      </form>
    </div>
  );
}
```

关键变化是 `optimisticUpdate` 选项——它让乐观更新变得声明式，不再需要手动管理 `useOptimistic` 的状态回滚。

## useAction：非表单场景的 Actions

`useAction` 是 v2 新增的 hook，用于按钮点击、拖拽、定时任务等非表单触发的异步操作。

```javascript
import { useAction } from 'react';

function FileUploader() {
  const { execute, isPending, error, data } = useAction(
    async (file) => {
      const presignedUrl = await api.getUploadUrl(file.name);
      await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
      });
      return api.confirmUpload(file.name);
    },
    {
      onSuccess: (result) => toast.success(`上传成功: ${result.name}`),
      onError: (err) => toast.error(err.message),
      retry: { count: 3, delay: 1000 },
    }
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
      {isPending ? '上传中...' : '拖拽文件到此处'}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

内置重试机制是亮点——`retry` 配置支持指数退避，这在移动端弱网环境下特别有用。

## Actions 与 Suspense 的深度集成

v2 Actions 可以直接驱动 Suspense 边界，实现真正的「加载态即 UI」模式：

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
  const orders = use(api.getOrders()); // 直接在渲染中读取

  const [filtered, filterAction, isPending] = useActionState(
    async (prev, formData) => {
      const status = formData.get('status');
      return api.getOrders({ status });
    },
    orders,
  );

  return (
    <div style={{ transition: isPending ? 'opacity 150ms' : undefined }}>
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

`transition` 配合 `isPending` 让过滤操作有了优雅的渐变效果，不会出现内容闪烁。

## 小结

- `useActionState` 新增 `optimisticUpdate` 选项，乐观更新变得声明式
- `useAction` hook 覆盖非表单异步场景，内置重试和生命周期回调
- Actions 与 Suspense 深度集成，pending 状态自然驱动 UI 过渡
- 错误恢复机制更智能，失败时自动回滚乐观状态
- Actions 已成为 React 异步操作的标准范式，建议替代传统的 useEffect + fetch 模式
