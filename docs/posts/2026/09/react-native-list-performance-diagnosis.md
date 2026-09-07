---
title: "React Native 长列表卡顿排查：先测再调 FlatList"
date: 2026-09-07 19:14:42
tags:
  - 移动端
description: "从生产构建、JS 线程与列表布局入手定位 RN FlatList 的滚动卡顿。"
readingTime: 3
wordCount: 803
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

## 从一次真实的卡顿开始

假设商品列表滑到第 80 行时明显掉帧。先用发布构建在同一台设备、同一份数据上复现，记录滚动方向、行数、图片尺寸和掉帧区间；开发模式的额外开销会干扰判断。然后分开看 JS 线程和 UI 线程：JS 忙于格式化价格、处理状态更新时，触摸反馈可能迟滞；UI 线程忙于图片解码或复杂绘制时，即使 JS 很空闲也会卡。不要一上来调 `windowSize`，否则可能只是把卡顿换成白块。

固定高度的行可提供 `getItemLayout`，但有换行标题、动态字体或展开区域的行不能伪造固定高度，否则 `scrollToIndex` 会定位错误。图片需按显示尺寸加载并缓存；列表项只接收渲染所需的稳定字段。若 `renderItem` 闭包每次都变化，或者父组件把全局 store 的每次变动传给整张列表，即使包了 `memo` 也可能持续重渲染。

```tsx
const Row = memo(function Row({ item, onOpen }: RowProps) {
  return <Pressable onPress={() => onOpen(item.id)}><Text>{item.title}</Text></Pressable>;
});
// 数据、keyExtractor、onOpen 的稳定性也要一起检查，不能只给 Row 加 memo。
```

## 每次只验证一个假设

先记录基线的帧时间、首屏时间、内存峰值和空白行数量。若怀疑渲染范围过大，只改变一个虚拟化参数，重复相同的滑动路线；若怀疑状态扇出，给行组件加渲染计数并模拟收藏一件商品，确认只有受影响的行更新。最后在低端设备上复测快速滑动、返回列表位置、字体放大与图片加载失败。优化后如果帧率提高但出现白块或焦点丢失，这不是完成。

参考：[React Native 性能指南](https://reactnative.dev/docs/performance)。
