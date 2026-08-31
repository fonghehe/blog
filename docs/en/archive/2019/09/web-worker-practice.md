---
title: "Web Worker Multi-Threading in Practice"
date: 2019-09-30 10:13:44
tags:
  - Frontend
readingTime: 3
description: "When the frontend hits heavy computation, the page freezes—you can't scroll, clicks don't respond, and animations drop frames. The root cause is JavaScript's single thread: the main thread is saturated by computation tasks. Web Workers let you run scripts on a background thread, freeing up the main thread."
wordCount: 270
---

When the frontend hits heavy computation, the page freezes—you can't scroll, clicks don't respond, and animations drop frames. The root cause is JavaScript's single thread: the main thread is saturated by computation tasks. Web Workers let you run scripts on a background thread, freeing up the main thread.

## Basic Usage

```javascript
// main.js - 主线程
const worker = new Worker("./worker.js");

// 发送消息给 Worker
worker.postMessage({ type: "CALC", data: [1, 2, 3, 4, 5] });

// 接收 Worker 返回的结果
worker.onmessage = (event) => {
  console.log("计算结果:", event.data);
};

// 错误处理
worker.onerror = (error) => {
  console.error("Worker 出错:", error.message);
};

// 不用时终止
worker.terminate();
```

```javascript
// worker.js - Worker 线程
self.onmessage = (event) => {
  const { type, data } = event.data;

  if (type === "CALC") {
    const result = heavyCalculation(data);
    self.postMessage(result);
  }
};

function heavyCalculation(arr) {
  let sum = 0;
  for (let i = 0; i < 10000000; i++) {
    sum += arr.reduce((a, b) => a + b, 0);
  }
  return sum;
}
```

A Worker thread can't access the DOM, `window`, or `document`. The APIs it can use include: `navigator`, `location` (read-only), `setTimeout`/`setInterval`, `fetch`, `WebSocket`, and so on.

## In Practice: Large CSV File Parsing

A user uploads a 50MB CSV file; parsing it on the main thread would freeze the page:

```javascript
// csv-worker.js
self.onmessage = (event) => {
  const { csvText } = event.data;
  const lines = csvText.split("\n");
  const headers = lines[0].split(",");
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(",");
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim();
    });
    result.push(row);

    if (i % 1000 === 0) {
      self.postMessage({
        type: "progress",
        processed: i,
        total: lines.length,
      });
    }
  }

  self.postMessage({ type: "complete", data: result });
};
```

```javascript
// 主线程
function parseCSVInWorker(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./csv-worker.js");
    const progressBar = document.getElementById("progress");

    worker.onmessage = (event) => {
      const { type, processed, total, data } = event.data;

      if (type === "progress") {
        progressBar.style.width = `${(processed / total) * 100}%`;
      }
      if (type === "complete") {
        worker.terminate();
        resolve(data);
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    const reader = new FileReader();
    reader.onload = () => worker.postMessage({ csvText: reader.result });
    reader.readAsText(file);
  });
}
```

## Wrapping a Worker Pool

Creating a Worker each time has overhead, so a Worker Pool reuses them:

```javascript
class WorkerPool {
  constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
    this.workers = [];
    this.queue = [];
    this.workerStatus = [];

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript);
      worker.onmessage = (event) => this._handleResult(i, event.data);
      this.workers.push(worker);
      this.workerStatus.push(false);
    }
  }

  exec(data) {
    return new Promise((resolve, reject) => {
      const task = { data, resolve, reject };
      const freeIdx = this.workerStatus.indexOf(false);

      if (freeIdx !== -1) {
        this._runTask(freeIdx, task);
      } else {
        this.queue.push(task);
      }
    });
  }

  _runTask(workerIdx, task) {
    this.workerStatus[workerIdx] = true;
    this.workers[workerIdx]._currentTask = task;
    this.workers[workerIdx].postMessage(task.data);
  }

  _handleResult(workerIdx, result) {
    const task = this.workers[workerIdx]._currentTask;
    task.resolve(result);
    this.workerStatus[workerIdx] = false;

    if (this.queue.length > 0) {
      this._runTask(workerIdx, this.queue.shift());
    }
  }

  terminate() {
    this.workers.forEach((w) => w.terminate());
  }
}

// 使用
const pool = new WorkerPool("./calc-worker.js", 4);

const results = await Promise.all([
  pool.exec({ type: "sort", data: bigArray1 }),
  pool.exec({ type: "sort", data: bigArray2 }),
  pool.exec({ type: "filter", data: bigArray3 }),
  pool.exec({ type: "aggregate", data: bigArray4 }),
]);
```

## Loading External Libraries with importScripts

```javascript
// worker.js
importScripts("https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.min.js");

self.onmessage = (event) => {
  const sorted = _.sortBy(event.data, "name");
  self.postMessage(sorted);
};
```

`importScripts` is synchronous and blocking—the Worker won't process messages until loading finishes.

## Data Transfer Optimization

Data passed via `postMessage` is structured-cloned, which has a performance cost:

```javascript
// 低效：每次克隆大数据
worker.postMessage(bigArray);

// 高效：Transferable 对象，所有权转移，零拷贝
const buffer = new ArrayBuffer(1024 * 1024);
worker.postMessage(buffer, [buffer]);
// buffer 转移后，主线程不能再访问
```

Transferable applies to `ArrayBuffer`, `MessagePort`, and `ImageBitmap`.

## React Hook Wrapper

```javascript
function useWorker(workerScript) {
  const workerRef = useRef(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    workerRef.current = new Worker(workerScript);
    workerRef.current.onmessage = (e) => setResult(e.data);
    return () => workerRef.current.terminate();
  }, [workerScript]);

  const post = useCallback((data) => {
    workerRef.current?.postMessage(data);
  }, []);

  return { result, post };
}

// 使用
function DataProcessor({ data }) {
  const { result, post } = useWorker("./process-worker.js");

  useEffect(() => {
    if (data) post({ type: "process", data });
  }, [data]);

  return result ? <ResultView data={result} /> : <Loading />;
}
```

## Debugging

Debugging a Worker in Chrome DevTools:
1. Sources → find the Workers group in the left sidebar.
2. You can set breakpoints and inspect variables.
3. `console.log` output appears in the main Console (tagged with `[Worker]`).

## Summary

- Web Workers run JS on a background thread without blocking the main thread—great for heavy computation and file parsing.
- The main thread and Worker communicate via `postMessage` / `onmessage`.
- Transferable objects (`ArrayBuffer`) enable zero-copy transfer of large data.
- Workers can't access the DOM; available APIs are limited (fetch, WebSocket, timers, etc.).
- Use a Worker Pool for frequent tasks to reuse threads and avoid create/destroy overhead.
- Wrap it as a `useWorker` Hook in React for cleaner usage.
