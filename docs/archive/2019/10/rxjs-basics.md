---
title: "RxJS 基础 Observable 入门"
date: 2019-10-31 14:32:13
tags:
  - Angular
readingTime: 3
description: "RxJS 是 JavaScript 的响应式编程库，它基于 Observable 模式，提供了一套强大的异步数据流处理工具。Angular 生态深度依赖 RxJS，即使在 React 项目中，RxJS 也能优雅地处理复杂的异步场景。本文从 Observable 的基本概念入手，系统介绍 RxJS 的核心用法。"
---

RxJS 是 JavaScript 的响应式编程库，它基于 Observable 模式，提供了一套强大的异步数据流处理工具。Angular 生态深度依赖 RxJS，即使在 React 项目中，RxJS 也能优雅地处理复杂的异步场景。本文从 Observable 的基本概念入手，系统介绍 RxJS 的核心用法。

## 什么是 Observable

Observable 代表一个可被订阅的数据流。与 Promise 只能 resolve 一次不同，Observable 可以发出多个值：

```js
import { Observable } from 'rxjs';

// 创建一个 Observable
const observable = new Observable(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.next(3);

  setTimeout(() => {
    subscriber.next(4);
    subscriber.complete();
  }, 1000);
});

// 订阅
console.log('开始订阅');
observable.subscribe({
  next: value => console.log('收到值:', value),
  error: err => console.error('错误:', err),
  complete: () => console.log('完成')
});

// 输出：
// 开始订阅
// 收到值: 1
// 收到值: 2
// 收到值: 3
// （1秒后）
// 收到值: 4
// 完成
```

## 创建 Observable 的工厂函数

RxJS 提供了丰富的创建函数，不需要手动 `new Observable`：

```js
import {
  of,
  from,
  interval,
  timer,
  fromEvent,
  throwError,
  EMPTY,
  combineLatest,
  merge,
  zip
} from 'rxjs';

// of: 发出一系列值后完成
of(1, 2, 3).subscribe(console.log);
// 1, 2, 3

// from: 将数组、Promise、迭代器转换为 Observable
from([10, 20, 30]).subscribe(console.log);
// 10, 20, 30

from(fetch('/api/data').then(r => r.json())).subscribe(console.log);

// interval: 每隔一段时间发出递增的数字
interval(1000).subscribe(x => console.log(x));
// 0, 1, 2, 3 ... (每秒)

// timer: 延迟后开始发出
timer(3000, 1000).subscribe(x => console.log(x));
// 3秒后: 0, 1, 2 ... (每秒)

// fromEvent: 从 DOM 事件创建
fromEvent(document, 'click').subscribe(event => {
  console.log('点击位置:', event.clientX, event.clientY);
});

// EMPTY: 立即完成的空 Observable
EMPTY.subscribe({
  next: () => console.log('不会执行'),
  complete: () => console.log('立即完成')
});

// throwError: 立即发出错误
throwError('出错了').subscribe({
  error: err => console.error(err)
});
```

## 操作符（Operators）

操作符是 RxJS 的核心，它们对 Observable 进行变换、过滤、组合：

```js
import { of, interval } from 'rxjs';
import {
  map,
  filter,
  take,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  mergeMap,
  catchError,
  tap,
  reduce,
  scan
} from 'rxjs/operators';

// 链式调用
of(1, 2, 3, 4, 5)
  .pipe(
    filter(x => x % 2 === 0),    // 过滤偶数
    map(x => x * 10),             // 乘以 10
    tap(x => console.log('中间值:', x))  // 副作用
  )
  .subscribe(result => console.log('最终结果:', result));
// 中间值: 20
// 最终结果: 20
// 中间值: 40
// 最终结果: 40
```

### 转换操作符

```js
import { from } from 'rxjs';
import { map, mapTo, pluck, scan, reduce } from 'rxjs/operators';

// map: 转换每个值
of(1, 2, 3).pipe(
  map(x => x * x)
).subscribe(console.log);
// 1, 4, 9

// pluck: 提取嵌套属性
from([
  { user: { name: '张三' } },
  { user: { name: '李四' } }
]).pipe(
  pluck('user', 'name')
).subscribe(console.log);
// '张三', '李四'

// scan: 累加器（类似 reduce，但每个中间值都会发出）
of(1, 2, 3, 4).pipe(
  scan((acc, val) => acc + val, 0)
).subscribe(console.log);
// 1, 3, 6, 10
```

### 过滤操作符

```js
import { interval, fromEvent, Subject } from 'rxjs';
import {
  filter,
  take,
  takeUntil,
  debounceTime,
  throttleTime,
  distinctUntilChanged,
  first,
  last
} from 'rxjs/operators';

// take: 只取前 N 个值
interval(1000).pipe(
  take(3)
).subscribe(console.log);
// 0, 1, 2 然后完成

// takeUntil: 直到另一个 Observable 发出值
const stop$ = new Subject();

interval(1000).pipe(
  takeUntil(stop$)
).subscribe(console.log);

setTimeout(() => stop$.next(), 5000);
// 5秒后停止: 0, 1, 2, 3, 4

// debounceTime: 防抖
fromEvent(document.querySelector('#search'), 'input').pipe(
  debounceTime(300),
  pluck('target', 'value'),
  distinctUntilChanged()
).subscribe(query => {
  console.log('搜索:', query);
});

// throttleTime: 节流
fromEvent(document, 'scroll').pipe(
  throttleTime(100)
).subscribe(() => {
  console.log('页面滚动');
});
```

## 高阶操作符

高阶操作符处理的是"Observable 的 Observable"：

```js
import { interval, of, timer } from 'rxjs';
import {
  switchMap,
  mergeMap,
  concatMap,
  exhaustMap
} from 'rxjs/operators';

// switchMap: 切换到新的 Observable，取消之前的
// 典型场景：搜索框自动补全
fromEvent(searchInput, 'input').pipe(
  debounceTime(300),
  pluck('target', 'value'),
  switchMap(query =>
    from(fetch(`/api/search?q=${query}`).then(r => r.json()))
  )
).subscribe(results => {
  renderResults(results);
});

// mergeMap: 并行执行所有内部 Observable
// 典型场景：批量请求
of(1, 2, 3).pipe(
  mergeMap(id =>
    from(fetch(`/api/user/${id}`).then(r => r.json()))
  )
).subscribe(user => {
  console.log('用户:', user);
});
// 三个请求并行执行

// concatMap: 顺序执行，一个完成后再执行下一个
// 典型场景：有序操作队列
of(1, 2, 3).pipe(
  concatMap(id =>
    from(fetch(`/api/user/${id}`).then(r => r.json()))
  )
).subscribe(user => {
  console.log('用户:', user);
});
// 按顺序 1 → 2 → 3 依次执行

// exhaustMap: 忽略新值直到当前 Observable 完成
// 典型场景：防止重复提交
fromEvent(submitBtn, 'click').pipe(
  exhaustMap(() =>
    from(fetch('/api/submit', { method: 'POST' }))
  )
).subscribe(response => {
  console.log('提交成功');
});
```

## Subject

Subject 既是 Observable 也是 Observer，用于在多个订阅者之间共享数据：

```js
import { Subject, BehaviorSubject, ReplaySubject } from 'rxjs';

// Subject: 普通主题
const subject = new Subject();

subject.subscribe(x => console.log('订阅者A:', x));
subject.next(1);

subject.subscribe(x => console.log('订阅者B:', x));
subject.next(2);
// 订阅者A: 2（能收到）
// 订阅者B: 2（能收到）

// BehaviorSubject: 保存最新值，新订阅者立即收到
const behavior = new BehaviorSubject('初始值');

behavior.subscribe(x => console.log('订阅者A:', x));
// 立即输出: 订阅者A: 初始值

behavior.next('新值');

behavior.subscribe(x => console.log('订阅者B:', x));
// 立即输出: 订阅者B: 新值（收到最新值）

// ReplaySubject: 重放最近 N 个值
const replay = new ReplaySubject(3);

replay.next(1);
replay.next(2);
replay.next(3);
replay.next(4);

replay.subscribe(x => console.log('新订阅者:', x));
// 重放: 2, 3, 4（最近3个值）
```

## 错误处理

```js
import { of, throwError, timer } from 'rxjs';
import { catchError, retry, retryWhen, delay, map } from 'rxjs/operators';

// catchError: 捕获错误并返回 fallback Observable
from(fetch('/api/data')).pipe(
  catchError(err => {
    console.error('请求失败:', err);
    return of({ data: '默认数据' });  // 返回默认值
  })
).subscribe(data => console.log(data));

// retry: 自动重试
from(fetch('/api/data')).pipe(
  retry(3)  // 失败后重试3次
).subscribe(data => console.log(data));

// retryWhen: 自定义重试策略
from(fetch('/api/data')).pipe(
  retryWhen(errors => errors.pipe(
    delay(1000),
    take(3),
    concat(throwError('重试次数已达上限'))
  ))
).subscribe(
  data => console.log(data),
  err => console.error(err)
);
```

## 取消订阅

```js
import { Subscription, interval } from 'rxjs';

// 手动管理订阅
const sub: Subscription = interval(1000).subscribe(console.log);

// 取消订阅
sub.unsubscribe();

// 合并多个订阅
const subs = new Subscription();
subs.add(interval(1000).subscribe(x => console.log('A:', x)));
subs.add(interval(2000).subscribe(x => console.log('B:', x)));

// 一次性取消所有
subs.unsubscribe();
```

## 小结

- Observable 代表可被订阅的数据流，可以发出多个值
- `of`、`from`、`interval`、`fromEvent` 是最常用的创建函数
- 操作符通过 `pipe` 链式调用，分为转换、过滤、组合等类型
- `switchMap` 用于搜索场景，`mergeMap` 用于并行请求，`concatMap` 用于有序执行
- Subject 是多播的核心，BehaviorSubject 保存最新值，ReplaySubject 重放历史值
- `catchError` 和 `retry` 用于错误处理
- 及时取消订阅避免内存泄漏
