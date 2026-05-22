---
title: "React 20 Actions v2 增強：落地路徑與實戰建議"
date: 2025-01-03 11:57:34
tags:
  - React
readingTime: 2
description: "React 20 中的 Actions 機製迎來重大升級。v1 版本的 Actions 主要解決了表單提交場景，v2 則將其擴展為通用的異步操作原語，覆蓋了樂觀更新、錯誤邊界集成和事務性狀態管理。"
wordCount: 385
---

React 20 中的 Actions 機製迎來重大升級。v1 版本的 Actions 主要解決了表單提交場景，v2 則將其擴展為通用的異步操作原語，覆蓋了樂觀更新、錯誤邊界集成和事務性狀態管理。

## useActionState 重新設計

v2 的 `useActionState` 不再侷限於 form action，現在可以包裹任何異步函數，並且內置了 pending 狀態、樂觀更新和自動錯誤恢復。

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
          {isPending ? '發送中...' : '發表評論'}
        </button>
      </form>
    </div>
  );
}
```

關鍵變化是 `optimisticUpdate` 選項——它讓樂觀更新變得聲明式，不再需要手動管理 `useOptimistic` 的狀態回滾。

## useAction：非表單場景的 Actions

`useAction` 是 v2 新增的 hook，用於按鈕點擊、拖拽、定時任務等非表單觸發的異步操作。

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
      onSuccess: (result) => toast.success(`上傳成功: ${result.name}`),
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
      {isPending ? '上傳中...' : '拖拽文件到此處'}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

內置重試機製是亮點——`retry` 設定支援指數退避，這在移動端弱網環境下特別有用。

## Actions 與 Suspense 的深度集成

v2 Actions 可以直接驅動 Suspense 邊界，實現真正的「加載態即 UI」模式：

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
  const orders = use(api.getOrders()); // 直接在渲染中讀取

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
          <option value="pending">待處理</option>
          <option value="shipped">已發貨</option>
        </select>
      </form>
      <Table data={filtered} />
    </div>
  );
}
```

`transition` 配合 `isPending` 讓過濾操作有了優雅的漸變效果，不會出現內容閃爍。

## 小結

- `useActionState` 新增 `optimisticUpdate` 選項，樂觀更新變得聲明式
- `useAction` hook 覆蓋非表單異步場景，內置重試和生命週期回調
- Actions 與 Suspense 深度集成，pending 狀態自然驅動 UI 過渡
- 錯誤恢復機製更智能，失敗時自動回滾樂觀狀態
- Actions 已成為 React 異步操作的標準範式，建議替代傳統的 useEffect + fetch 模式
