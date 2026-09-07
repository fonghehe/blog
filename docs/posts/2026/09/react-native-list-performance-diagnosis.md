---
title: "React Native 长列表卡顿排查：先测再调 FlatList"
date: 2026-09-07 19:14:42
tags:
  - 移动端
description: "从生产构建、JS 线程与列表布局入手定位 RN FlatList 的滚动卡顿。"
readingTime: 1
wordCount: 375
---

长列表卡顿不一定是 `FlatList` 的窗口参数太小。行组件做了昂贵计算、图片解码占用主线程、滚动时触发全页状态更新，都可能表现为掉帧。先在接近正式发布的构建里复现，再决定改哪一层。

## 先分清瓶颈

记录设备、数据量、图片尺寸和出现卡顿的操作。比较 JS 线程与 UI 线程的帧率：若 JS 忙于格式化或重复渲染，优先缩小行组件依赖；若滚动时主线程持续繁忙，检查图片、布局和原生视图。调试模式的性能不能代表发布包。

## 只针对已确认的问题调参

固定高度行可提供 `getItemLayout`，免去每次滚动目标定位的测量；行 ID 用稳定业务键，不用数组下标。分页应在请求进行中去重，并在筛选条件变化时丢弃上一查询的响应。`windowSize`、批量渲染数量需要在低端真机上测内存和空白区域，不能只追求一个更大的数字。

```tsx
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={renderItem}
  getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
  onEndReached={loadNextPage}
/>
```

上面的 `getItemLayout` 仅适用于高度确实固定的行；动态文本、系统字体放大和多语言换行会破坏这个前提。验收要覆盖首次加载、快速滑到底部、切筛选条件、图片未缓存和字体放大，而不只是空数据下的滚动演示。

参考：[React Native 性能指南](https://reactnative.dev/docs/performance)。
