---
title: "React 20 Suspense 改進"
date: 2025-01-16 10:00:00
tags:
  - React
readingTime: 3
description: "React 20 的 Suspense 經歷了自 18 以來最大的一次迭代。新增的 SuspenseList 組件、流式 SSR 改進、以及與 Actions 的深度集成，讓 Suspense 從「加載態佔位」進化為「數據獲取編排」。"
---

React 20 的 Suspense 經歷了自 18 以來最大的一次迭代。新增的 SuspenseList 組件、流式 SSR 改進、以及與 Actions 的深度集成，讓 Suspense 從「加載態佔位」進化為「數據獲取編排」。

## SuspenseList：控制加載順序

SuspenseList 解決了多個異步組件同時加載時的視覺混亂問題——你可以控制它們的出現順序。

```javascript
import { Suspense, SuspenseList } from 'react';

function Dashboard() {
  return (
    <SuspenseList revealOrder="forwards" tail="collapsed">
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <UserGrowthChart />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <ConversionChart />
      </Suspense>
    </SuspenseList>
  );
}
```

`revealOrder` 的取值：
- `"forwards"`：按順序展示，前面的沒加載完，後面的不顯示
- `"backwards"`：反向順序
- `"together"`：全部加載完後一起展示
- `undefined`：誰先好誰先出（默認行為）

`tail="collapsed"` 表示還沒輪到的組件不顯示 fallback，避免了一排 skeleton 的視覺噪音。

```javascript
// 實際場景：聊天消息列表
function ChatMessages({ messages }) {
  return (
    <SuspenseList revealOrder="forwards" tail={3}>
      {messages.map(msg => (
        <Suspense key={msg.id} fallback={<MessageSkeleton />}>
          <MessageRenderer id={msg.id} />
        </Suspense>
      ))}
    </SuspenseList>
  );
}
// tail={3} 表示最多顯示 3 個 fallback skeleton
// 超出的部分完全隱藏，避免頁面閃爍
```

## useSuspenseQuery：數據獲取新範式

React 20 將 `use` hook 和 Suspense 結合，推出了 `useSuspenseQuery`，替代了傳統的 useEffect + fetch 模式。

```javascript
import { useSuspenseQuery } from '@tanstack/react-query';
// 也可以直接用 React 內置的
import { use, Suspense } from 'react';

// 方案一：React Query 集成
function UserProfile({ userId }) {
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', userId],
    queryFn: () => api.getUser(userId),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <Avatar src={user.avatar} />
      <h2>{user.name}</h2>
      <p>{user.bio}</p>
    </div>
  );
}

// 方案二：React 原生 use hook
function UserProfileNative({ userPromise }) {
  const user = use(userPromise); // 自動觸發 Suspense

  return (
    <div>
      <Avatar src={user.avatar} />
      <h2>{user.name}</h2>
    </div>
  );
}

// 使用方式
function App({ params }) {
  const userPromise = api.getUser(params.id); // 在 Server Component 中發起

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfileNative userPromise={userPromise} />
    </Suspense>
  );
}
```

關鍵區別：`use` hook 可以接受 Promise 作為參數，它會在組件渲染時掛起（suspend），而不是在 effect 中異步設置狀態。這讓數據獲取和渲染合為一體。

## 流式 SSR 的 Selective Hydration 改進

React 20 的流式 SSR 現在支持選擇性注水——用户交互的組件優先注水，其他的延遲處理。

```javascript
// app/layout.tsx (Next.js 16)
import { Suspense } from 'react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <header>
          <Navigation /> {/* 交互組件，優先注水 */}
        </header>
        <main>
          {children}
        </main>
        <footer>
          <Suspense fallback={null}>
            <AnalyticsWidget /> {/* 延遲注水，不影響首屏 */}
          </Suspense>
        </footer>
      </body>
    </html>
  );
}
```

用户點擊導航時，React 會優先注水 `<Navigation>` 組件，即使頁面其他部分還沒完成注水。這顯著改善了 TTI（Time to Interactive）。

## 嵌套 Suspense 的回退策略

React 20 允許 Suspense 邊界指定回退顯示的延遲時間，避免快速加載場景下的閃爍：

```javascript
function App() {
  return (
    <Suspense
      fallback={<PageSkeleton />}
      // 延遲 200ms 顯示 fallback，如果 200ms 內加載完就不顯示
      unstable_avoidFallback={true}
      unstable_expectedLoadTime={200}
    >
      <Suspense
        fallback={<SectionSkeleton />}
        unstable_expectedLoadTime={50}
      >
        <SlowDataComponent />
      </Suspense>
      <FastComponent />
    </Suspense>
  );
}
```

`unstable_expectedLoadTime` 給 React 一個提示，告訴它這個邊界內的內容大概多久能加載好。React 會根據這個提示決定是否要顯示 fallback——如果預計加載時間很短，就保持上一個狀態不閃。

## 小結

- SuspenseList 控制多個異步組件的展示順序，解決視覺混亂問題
- `use` hook 讓數據獲取和渲染合一，徹底替代 useEffect + fetch
- 流式 SSR 的 Selective Hydration 大幅改善 TTI，交互組件優先注水
- Suspense 邊界支持延遲迴退，避免快速加載場景下的 UI 閃爍
- Suspense 已從「加載佔位」演變為完整的數據獲取編排方案
