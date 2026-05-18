---
title: "RxJS 基礎 Observable 入門"
date: 2019-10-31 14:32:13
tags:
  - Angular
readingTime: 3
description: "RxJS 是 JavaScript 的響應式程式設計庫，它基於 Observable 模式，提供了一套強大的非同步資料流處理工具。Angular 生態深度依賴 RxJS，即使在 React 專案中，RxJS 也能優雅地處理複雜的非同步場景。本文從 Observable 的基本概念入手，系統介紹 RxJS 的核心用法。"
---

RxJS 是 JavaScript 的響應式程式設計庫，它基於 Observable 模式，提供了一套強大的非同步資料流處理工具。Angular 生態深度依賴 RxJS，即使在 React 專案中，RxJS 也能優雅地處理複雜的非同步場景。本文從 Observable 的基本概念入手，系統介紹 RxJS 的核心用法。

## 什麼是 Observable

Observable 代表一個可被訂閱的資料流。與 Promise 只能 resolve 一次不同，Observable 可以發出多個值：

```js
import { Observable } from 'rxjs';

// 建立一個 Observable
const observable = new Observable(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.next(3);

  setTimeout(() => {
    subscriber.next(4);
    subscriber.complete();
  }, 1000);
});

// 訂閱
console.log('開始訂閱');
observable.subscribe({
  next: value => console.log('收到值:', value),
  error: err => console.error('錯誤:', err),
  complete: () => console.log('完成')
});

// 輸出：
// 開始訂閱
// 收到值: 1
// 收到值: 2
// 收到值: 3
// （1秒後）
// 收到值: 4
// 完成
```

## 建立 Observable 的工廠函式

RxJS 提供了豐富的建立函式，不需要手動 `new Observable`：

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

// of: 發出一系列值後完成
of(1, 2, 3).subscribe(console.log);
// 1, 2, 3

// from: 將陣列、Promise、迭代器轉換為 Observable
from([10, 20, 30]).subscribe(console.log);
// 10, 20, 30

from(fetch('/api/data').then(r => r.json())).subscribe(console.log);

// interval: 每隔一段時間發出遞增的數字
interval(1000).subscribe(x => console.log(x));
// 0, 1, 2, 3 ... (每秒)

// timer: 延遲後開始發出
timer(3000, 1000).subscribe(x => console.log(x));
// 3秒後: 0, 1, 2 ... (每秒)

// fromEvent: 從 DOM 事件建立
fromEvent(document, 'click').subscribe(event => {
  console.log('點選位置:', event.clientX, event.clientY);
});

// EMPTY: 立即完成的空 Observable
EMPTY.subscribe({
  next: () => console.log('不會執行'),
  complete: () => console.log('立即完成')
});

// throwError: 立即發出錯誤
throwError('出錯了').subscribe({
  error: err => console.error(err)
});
```

## 運算子（Operators）

運算子是 RxJS 的核心，它們對 Observable 進行變換、過濾、組合：

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

// 鏈式呼叫
of(1, 2, 3, 4, 5)
  .pipe(
    filter(x => x % 2 === 0),    // 過濾偶數
    map(x => x * 10),             // 乘以 10
    tap(x => console.log('中間值:', x))  // 副作用
  )
  .subscribe(result => console.log('最終結果:', result));
// 中間值: 20
// 最終結果: 20
// 中間值: 40
// 最終結果: 40
```

### 轉換運算子

```js
import { from } from 'rxjs';
import { map, mapTo, pluck, scan, reduce } from 'rxjs/operators';

// map: 轉換每個值
of(1, 2, 3).pipe(
  map(x => x * x)
).subscribe(console.log);
// 1, 4, 9

// pluck: 提取巢狀屬性
from([
  { user: { name: '張三' } },
  { user: { name: '李四' } }
]).pipe(
  pluck('user', 'name')
).subscribe(console.log);
// '張三', '李四'

// scan: 累加器（類似 reduce，但每個中間值都會發出）
of(1, 2, 3, 4).pipe(
  scan((acc, val) => acc + val, 0)
).subscribe(console.log);
// 1, 3, 6, 10
```

### 過濾運算子

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

// take: 只取前 N 個值
interval(1000).pipe(
  take(3)
).subscribe(console.log);
// 0, 1, 2 然後完成

// takeUntil: 直到另一個 Observable 發出值
const stop$ = new Subject();

interval(1000).pipe(
  takeUntil(stop$)
).subscribe(console.log);

setTimeout(() => stop$.next(), 5000);
// 5秒後停止: 0, 1, 2, 3, 4

// debounceTime: 防抖
fromEvent(document.querySelector('#search'), 'input').pipe(
  debounceTime(300),
  pluck('target', 'value'),
  distinctUntilChanged()
).subscribe(query => {
  console.log('搜尋:', query);
});

// throttleTime: 節流
fromEvent(document, 'scroll').pipe(
  throttleTime(100)
).subscribe(() => {
  console.log('頁面滾動');
});
```

## 高階運算子

高階運算子處理的是"Observable 的 Observable"：

```js
import { interval, of, timer } from 'rxjs';
import {
  switchMap,
  mergeMap,
  concatMap,
  exhaustMap
} from 'rxjs/operators';

// switchMap: 切換到新的 Observable，取消之前的
// 典型場景：搜尋框自動補全
fromEvent(searchInput, 'input').pipe(
  debounceTime(300),
  pluck('target', 'value'),
  switchMap(query =>
    from(fetch(`/api/search?q=${query}`).then(r => r.json()))
  )
).subscribe(results => {
  renderResults(results);
});

// mergeMap: 並行執行所有內部 Observable
// 典型場景：批次請求
of(1, 2, 3).pipe(
  mergeMap(id =>
    from(fetch(`/api/user/${id}`).then(r => r.json()))
  )
).subscribe(user => {
  console.log('使用者:', user);
});
// 三個請求並行執行

// concatMap: 順序執行，一個完成後再執行下一個
// 典型場景：有序操作佇列
of(1, 2, 3).pipe(
  concatMap(id =>
    from(fetch(`/api/user/${id}`).then(r => r.json()))
  )
).subscribe(user => {
  console.log('使用者:', user);
});
// 按順序 1 → 2 → 3 依次執行

// exhaustMap: 忽略新值直到當前 Observable 完成
// 典型場景：防止重複提交
fromEvent(submitBtn, 'click').pipe(
  exhaustMap(() =>
    from(fetch('/api/submit', { method: 'POST' }))
  )
).subscribe(response => {
  console.log('提交成功');
});
```

## Subject

Subject 既是 Observable 也是 Observer，用於在多個訂閱者之間共享資料：

```js
import { Subject, BehaviorSubject, ReplaySubject } from 'rxjs';

// Subject: 普通主題
const subject = new Subject();

subject.subscribe(x => console.log('訂閱者A:', x));
subject.next(1);

subject.subscribe(x => console.log('訂閱者B:', x));
subject.next(2);
// 訂閱者A: 2（能收到）
// 訂閱者B: 2（能收到）

// BehaviorSubject: 儲存最新值，新訂閱者立即收到
const behavior = new BehaviorSubject('初始值');

behavior.subscribe(x => console.log('訂閱者A:', x));
// 立即輸出: 訂閱者A: 初始值

behavior.next('新值');

behavior.subscribe(x => console.log('訂閱者B:', x));
// 立即輸出: 訂閱者B: 新值（收到最新值）

// ReplaySubject: 重放最近 N 個值
const replay = new ReplaySubject(3);

replay.next(1);
replay.next(2);
replay.next(3);
replay.next(4);

replay.subscribe(x => console.log('新訂閱者:', x));
// 重放: 2, 3, 4（最近3個值）
```

## 錯誤處理

```js
import { of, throwError, timer } from 'rxjs';
import { catchError, retry, retryWhen, delay, map } from 'rxjs/operators';

// catchError: 捕獲錯誤並返回 fallback Observable
from(fetch('/api/data')).pipe(
  catchError(err => {
    console.error('請求失敗:', err);
    return of({ data: '預設資料' });  // 返回預設值
  })
).subscribe(data => console.log(data));

// retry: 自動重試
from(fetch('/api/data')).pipe(
  retry(3)  // 失敗後重試3次
).subscribe(data => console.log(data));

// retryWhen: 自定義重試策略
from(fetch('/api/data')).pipe(
  retryWhen(errors => errors.pipe(
    delay(1000),
    take(3),
    concat(throwError('重試次數已達上限'))
  ))
).subscribe(
  data => console.log(data),
  err => console.error(err)
);
```

## 取消訂閱

```js
import { Subscription, interval } from 'rxjs';

// 手動管理訂閱
const sub: Subscription = interval(1000).subscribe(console.log);

// 取消訂閱
sub.unsubscribe();

// 合併多個訂閱
const subs = new Subscription();
subs.add(interval(1000).subscribe(x => console.log('A:', x)));
subs.add(interval(2000).subscribe(x => console.log('B:', x)));

// 一次性取消所有
subs.unsubscribe();
```

## 小結

- Observable 代表可被訂閱的資料流，可以發出多個值
- `of`、`from`、`interval`、`fromEvent` 是最常用的建立函式
- 運算子通過 `pipe` 鏈式呼叫，分為轉換、過濾、組合等型別
- `switchMap` 用於搜尋場景，`mergeMap` 用於並行請求，`concatMap` 用於有序執行
- Subject 是多播的核心，BehaviorSubject 儲存最新值，ReplaySubject 重放歷史值
- `catchError` 和 `retry` 用於錯誤處理
- 及時取消訂閱避免記憶體洩漏
