---
title: "React 20 Suspense 改进"
date: 2025-01-16 10:00:00
tags:
  - React
readingTime: 3
description: "React 20 的 Suspense 经历了自 18 以来最大的一次迭代。新增的 SuspenseList 组件、流式 SSR 改进、以及与 Actions 的深度集成，让 Suspense 从「加载态占位」进化为「数据获取编排」。"
wordCount: 557
---

React 20 的 Suspense 经历了自 18 以来最大的一次迭代。新增的 SuspenseList 组件、流式 SSR 改进、以及与 Actions 的深度集成，让 Suspense 从「加载态占位」进化为「数据获取编排」。

## SuspenseList：控制加载顺序

SuspenseList 解决了多个异步组件同时加载时的视觉混乱问题——你可以控制它们的出现顺序。

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
- `"forwards"`：按顺序展示，前面的没加载完，后面的不显示
- `"backwards"`：反向顺序
- `"together"`：全部加载完后一起展示
- `undefined`：谁先好谁先出（默认行为）

`tail="collapsed"` 表示还没轮到的组件不显示 fallback，避免了一排 skeleton 的视觉噪音。

```javascript
// 实际场景：聊天消息列表
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
// tail={3} 表示最多显示 3 个 fallback skeleton
// 超出的部分完全隐藏，避免页面闪烁
```

## useSuspenseQuery：数据获取新范式

React 20 将 `use` hook 和 Suspense 结合，推出了 `useSuspenseQuery`，替代了传统的 useEffect + fetch 模式。

```javascript
import { useSuspenseQuery } from '@tanstack/react-query';
// 也可以直接用 React 内置的
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
  const user = use(userPromise); // 自动触发 Suspense

  return (
    <div>
      <Avatar src={user.avatar} />
      <h2>{user.name}</h2>
    </div>
  );
}

// 使用方式
function App({ params }) {
  const userPromise = api.getUser(params.id); // 在 Server Component 中发起

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfileNative userPromise={userPromise} />
    </Suspense>
  );
}
```

关键区别：`use` hook 可以接受 Promise 作为参数，它会在组件渲染时挂起（suspend），而不是在 effect 中异步设置状态。这让数据获取和渲染合为一体。

## 流式 SSR 的 Selective Hydration 改进

React 20 的流式 SSR 现在支持选择性注水——用户交互的组件优先注水，其他的延迟处理。

```javascript
// app/layout.tsx (Next.js 16)
import { Suspense } from 'react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <header>
          <Navigation /> {/* 交互组件，优先注水 */}
        </header>
        <main>
          {children}
        </main>
        <footer>
          <Suspense fallback={null}>
            <AnalyticsWidget /> {/* 延迟注水，不影响首屏 */}
          </Suspense>
        </footer>
      </body>
    </html>
  );
}
```

用户点击导航时，React 会优先注水 `<Navigation>` 组件，即使页面其他部分还没完成注水。这显著改善了 TTI（Time to Interactive）。

## 嵌套 Suspense 的回退策略

React 20 允许 Suspense 边界指定回退显示的延迟时间，避免快速加载场景下的闪烁：

```javascript
function App() {
  return (
    <Suspense
      fallback={<PageSkeleton />}
      // 延迟 200ms 显示 fallback，如果 200ms 内加载完就不显示
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

`unstable_expectedLoadTime` 给 React 一个提示，告诉它这个边界内的内容大概多久能加载好。React 会根据这个提示决定是否要显示 fallback——如果预计加载时间很短，就保持上一个状态不闪。

## 小结

- SuspenseList 控制多个异步组件的展示顺序，解决视觉混乱问题
- `use` hook 让数据获取和渲染合一，彻底替代 useEffect + fetch
- 流式 SSR 的 Selective Hydration 大幅改善 TTI，交互组件优先注水
- Suspense 边界支持延迟回退，避免快速加载场景下的 UI 闪烁
- Suspense 已从「加载占位」演变为完整的数据获取编排方案
