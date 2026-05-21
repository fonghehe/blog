---
title: "Web Worker Multi-Threading in Practice"
date: 2019-09-30 10:13:44
tags:
  - Frontend
readingTime: 3
description: "前端遇到大数据量计算时，页面会卡死——滚动不了、点击没反应、动画掉帧。根本原因是 JavaScript 单线程，主线程被计算任务占满了。Web Worker 允许你在后台线程运行脚本，解放主线程。"
wordCount: 336
---

前端遇到大数据量计算时，页面会卡死——滚动不了、点击没反应、动画掉帧。根本原因是 JavaScript 单线程，主线程被计算任务占满了。Web Worker 允许你在后台线程运行脚本，解放主线程。

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

Worker 线程里不能访问 DOM、`window`、`document`。能用的 API：`navigator`、`location`（只读）、`setTimeout`/`setInterval`、`fetch`、`WebSocket` 等。

## In Practice: Large CSV File Parsing

用户上传 50MB 的 CSV 文件，主线程解析会卡死：

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

每次创建 Worker 有开销，用 Worker Pool 复用：

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

`importScripts` 是同步阻塞的，加载完成前 Worker 不会处理消息。

## Data Transfer Optimization

`postMessage` 传递的数据会被结构化克隆，有性能开销：

```javascript
// 低效：每次克隆大数据
worker.postMessage(bigArray);

// 高效：Transferable 对象，所有权转移，零拷贝
const buffer = new ArrayBuffer(1024 * 1024);
worker.postMessage(buffer, [buffer]);
// buffer 转移后，主线程不能再访问
```

Transferable 适用于 `ArrayBuffer`、`MessagePort`、`ImageBitmap`。

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

Chrome DevTools 调试 Worker：
1. Sources → 左侧目录找到 Workers 分组
2. 可以设断点、查看变量
3. `console.log` 输出在主 Console 中（标记了 `[Worker]`）

## Summary

- Web Worker 在后台线程运行 JS，不阻塞主线程，适合大数据计算、文件解析
- 主线程和 Worker 通过 `postMessage` / `onmessage` 通信
- 使用 Transferable 对象（ArrayBuffer）可以零拷贝传递大数据
- Worker 不能访问 DOM，能用的 API 有限（fetch、WebSocket、定时器等）
- 频繁任务用 Worker Pool 复用线程，避免创建销毁开销
- 在 React 中封装为 useWorker Hook，使用更简洁
