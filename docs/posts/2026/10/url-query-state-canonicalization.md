---
title: "把筛选条件放进 URL：可分享页面需要一个规范化协议"
date: 2026-10-29 11:01:42
tags:
  - JavaScript
  - 工程化
description: "用解析、规范化和历史导航设计列表状态，避免分享链接与画面各自为政。"
readingTime: 4
wordCount: 1189
---

用户把列表链接发给同事，对方却看到默认筛选。补上查询参数之后，返回键又一次退一个输入字符，刷新时还出现两次请求。URL 状态不是把对象 JSON 化就结束，它同时承担外部输入、分享协议和浏览器历史。

本文以关键词、状态和页码为例，限定这三个字段为页面拥有的查询空间。生产系统若还要保留活动追踪或其他模块参数，应先规定各自所有权，不能照搬这里“忽略未知参数”的策略。

## 解析时校验，内部只使用一种表示

URL 可以被手改，也可以来自旧版本。页码可能是负数、无限大或重复值，状态可能是未知枚举。解析器需要定义默认值与重复值规则，而不只是调用 `Number`。示例对状态取允许集合、去重后排序；单值字段取首次出现，页码限制为 1 到 9999。

关键词裁到 100 个 UTF-16 代码单元，是本例明确的协议上限，并非通用可见字符限制。真实产品如需按字素计数，应替换成一致的分段规则。URL 的编码和重复参数行为见 [WHATWG URL 标准](https://url.spec.whatwg.org/)。

```javascript
export function parseFilters(search) {
  const params = new URLSearchParams(search);
  const allowed = new Set(['open', 'closed']);
  const status = [...new Set(params.getAll('status')
    .filter(value => allowed.has(value)))].sort();
  const rawPage = params.get('page') ?? '1';
  const page = /^\d{1,4}$/.test(rawPage) && Number(rawPage) >= 1
    ? Number(rawPage) : 1;
  return { q: (params.get('q') ?? '').trim().slice(0, 100), status, page };
}

export function serializeFilters(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const status of filters.status) params.append('status', status);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params.toString();
}

export function canonicalSearch(search) {
  return serializeFilters(parseFilters(search));
}
```

序列化函数接收已经规范化的内部模型。外部对象必须先校验，不能把未知 status 直接传进去。默认页码从 URL 省略，状态按固定顺序写出，因此多个等价输入能落到同一个规范形式。测试应保证规范化幂等，以及解析再序列化后业务含义不变。

## 输入中的草稿不必每次都进入历史

搜索框正在输入的值可以暂存在本地，点击搜索或达到约定的防抖边界再提交 URL。正式改变查询时，根据用户意图使用 push；仅清理非法参数或同步同一次操作的中间状态时，可以 replace。不要把每次键盘输入都变成必须按返回键跨过的历史节点。

如果框架路由已经管理 history，就通过它更新，避免原生 `pushState` 与路由器各做一套。监听返回和前进时重新解析 URL 并恢复已提交的控件值。切换筛选通常重置页码，但恢复历史应尊重记录中的页码；这两种事件不能共用一个“任何变化都置第一页”的副作用。

## 规范化模型也应决定请求身份

UI、数据请求和缓存都从同一个已提交模型派生。把规范化结果作为查询身份，能够让 `status=open&status=closed` 与反过来的参数顺序共享语义。请求返回时核对当前身份，防止慢响应把新的筛选结果覆盖掉。

避免控件变化写 URL，URL 变化又写控件并再次写 URL 的循环。可以明确单向路径：输入草稿产生用户动作，动作提交 URL，路由解析产生查询模型，模型驱动展示和请求。只有规范形式不同时才清理地址，而且一次导航只触发一次有效加载。

## 分享能力有隐私和有效期边界

查询参数会进入历史、日志、复制内容和可能的来源信息。令牌、个人敏感查询和大段私有条件不适合直接放入链接。复杂共享视图可以保存服务端记录，用受权限保护的短 ID 分享；拿到 ID 不应等于拿到访问权限。

当枚举或字段定义变化时，决定是否保留旧参数迁移。默认值变化也会影响省略字段的旧链接：若分享必须精确复现，可记录协议版本或显式写入关键默认值。不要把“链接还能打开”当成结果语义没有改变。

## 从外部打开和历史恢复两条路径验收

固定测试空查询、重复参数、非法页码、未知枚举、中文和加号、参数顺序变化，以及旧版本链接。然后验证从外部打开、刷新、前进后退和快速连续搜索。断言控件、URL 和请求条件三者一致，并检查页面没有为规范化重复发起同一请求。

可分享页面的价值是让另一个人看到相同的问题现场。把查询当成小型协议维护，才能在不断添加筛选项后继续兑现这个承诺。
