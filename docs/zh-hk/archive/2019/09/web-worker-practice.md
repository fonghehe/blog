---
title: "Web Worker 多線程實踐"
date: 2019-09-30 10:13:44
tags:
  - 前端
readingTime: 3
description: "前端遇到大數據量計算時，頁面會卡死——滾動不了、點擊沒反應、動畫掉幀。根本原因是 JavaScript 單線程，主線程被計算任務佔滿了。Web Worker 允許你在後台線程運行腳本，解放主線程。"
wordCount: 348
---

前端遇到大數據量計算時，頁面會卡死——滾動不了、點擊沒反應、動畫掉幀。根本原因是 JavaScript 單線程，主線程被計算任務佔滿了。Web Worker 允許你在後台線程運行腳本，解放主線程。

## 基礎用法

```javascript
// main.js - 主線程
const worker = new Worker("./worker.js");

// 發送消息給 Worker
worker.postMessage({ type: "CALC", data: [1, 2, 3, 4, 5] });

// 接收 Worker 返回的結果
worker.onmessage = (event) => {
  console.log("計算結果:", event.data);
};

// 錯誤處理
worker.onerror = (error) => {
  console.error("Worker 出錯:", error.message);
};

// 不用時終止
worker.terminate();
```

```javascript
// worker.js - Worker 線程
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

Worker 線程裏不能訪問 DOM、`window`、`document`。能用的 API：`navigator`、`location`（只讀）、`setTimeout`/`setInterval`、`fetch`、`WebSocket` 等。

## 實戰：大文件 CSV 解析

用户上傳 50MB 的 CSV 文件，主線程解析會卡死：

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
// 主線程
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

## 封裝 Worker Pool

每次創建 Worker 有開銷，用 Worker Pool 複用：

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

## importScripts 引入外部庫

```javascript
// worker.js
importScripts("https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.min.js");

self.onmessage = (event) => {
  const sorted = _.sortBy(event.data, "name");
  self.postMessage(sorted);
};
```

`importScripts` 是同步阻塞的，加載完成前 Worker 不會處理消息。

## 數據傳輸優化

`postMessage` 傳遞的數據會被結構化克隆，有性能開銷：

```javascript
// 低效：每次克隆大數據
worker.postMessage(bigArray);

// 高效：Transferable 對象，所有權轉移，零拷貝
const buffer = new ArrayBuffer(1024 * 1024);
worker.postMessage(buffer, [buffer]);
// buffer 轉移後，主線程不能再訪問
```

Transferable 適用於 `ArrayBuffer`、`MessagePort`、`ImageBitmap`。

## React Hook 封裝

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

## 調試

Chrome DevTools 調試 Worker：
1. Sources → 左側目錄找到 Workers 分組
2. 可以設斷點、查看變量
3. `console.log` 輸出在主 Console 中（標記了 `[Worker]`）

## 小結

- Web Worker 在後台線程運行 JS，不阻塞主線程，適合大數據計算、文件解析
- 主線程和 Worker 通過 `postMessage` / `onmessage` 通信
- 使用 Transferable 對象（ArrayBuffer）可以零拷貝傳遞大數據
- Worker 不能訪問 DOM，能用的 API 有限（fetch、WebSocket、定時器等）
- 頻繁任務用 Worker Pool 複用線程，避免創建銷燬開銷
- 在 React 中封裝為 useWorker Hook，使用更簡潔
