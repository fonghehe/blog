---
title: "Node.js 性能調優實踐"
date: 2019-08-26 09:47:22
tags:
  - 性能優化
readingTime: 4
description: "Node.js 作為服務端運行時，性能調優是上線前必不可少的環節。從內存泄漏排查到事件循環監控，從 CPU profiling 到 GC 調參，Node.js 提供了豐富的工具鏈幫助我們定位性能瓶頸。本文將結合實際案例，系統講解 Node.js 性能調優的方法論和實踐技巧。"
---

Node.js 作為服務端運行時，性能調優是上線前必不可少的環節。從內存泄漏排查到事件循環監控，從 CPU profiling 到 GC 調參，Node.js 提供了豐富的工具鏈幫助我們定位性能瓶頸。本文將結合實際案例，系統講解 Node.js 性能調優的方法論和實踐技巧。

## 性能指標概覽

Node.js 應用需要關注的核心指標：

- **響應時間（RT）** — P50、P95、P99 延遲
- **吞吐量（QPS）** — 每秒處理的請求數
- **內存使用** — RSS、堆內存、堆外內存
- **CPU 使用率** — 單核利用率、事件循環延遲
- **GC 頻率和耗時** — 垃圾回收對響應時間的影響

## 內存泄漏排查

### 監控內存使用

```js
// 內存監控中間件
function memoryMonitor(req, res, next) {
  const mem = process.memoryUsage();

  console.log({
    rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
    heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
  });

  // 內存告警
  const heapUsedMB = mem.heapUsed / 1024 / 1024;
  if (heapUsedMB > 500) {
    console.warn(`堆內存超過 500MB: ${heapUsedMB.toFixed(2)} MB`);
  }

  next();
}
```

### 使用 --inspect 進行堆分析

```bash
# 啓動時開啓 inspector
node --inspect=0.0.0.0:9229 app.js

# 然後在 Chrome 中打開 chrome://inspect
```

### 常見內存泄漏場景

**場景一：閉包持有大對象引用**

```js
// 泄漏版本
const cache = {};

function handler(req, res) {
  const key = req.url;

  // 如果不限制 cache 大小，會無限增長
  cache[key] = {
    data: heavyComputation(),
    timestamp: Date.now(),
  };

  res.json(cache[key].data);
}

// 修復版本：使用 LRU 緩存
const LRU = require('lru-cache');
const cache = new LRU({
  max: 1000,                    // 最大緩存條目數
  maxAge: 1000 * 60 * 10,      // 10 分鐘過期
  length: (n) => n.data.length, // 計算緩存佔用
});

function handler(req, res) {
  const key = req.url;
  let data = cache.get(key);

  if (!data) {
    data = { data: heavyComputation(), timestamp: Date.now() };
    cache.set(key, data);
  }

  res.json(data.data);
}
```

**場景二：事件監聽器未移除**

```js
// 泄漏版本
function handleConnection(socket) {
  // 每次連接都添加監聽器，但從未移除
  socket.on('data', (data) => {
    processData(data);
  });

  // 更糟糕的是在外部對象上監聽
  globalEventEmitter.on('global-event', () => {
    // socket 關閉後這個監聽器仍然存在
    socket.write('event happened');
  });
}

// 修復版本
function handleConnection(socket) {
  const onData = (data) => processData(data);
  const onGlobalEvent = () => {
    if (!socket.destroyed) {
      socket.write('event happened');
    }
  };

  socket.on('data', onData);
  globalEventEmitter.on('global-event', onGlobalEvent);

  socket.on('close', () => {
    socket.removeListener('data', onData);
    globalEventEmitter.removeListener('global-event', onGlobalEvent);
  });
}
```

**場景三：全局變量意外增長**

```js
// 泄漏版本：無限制的全局數組
const requestLogs = [];

app.use((req, res, next) => {
  requestLogs.push({
    url: req.url,
    method: req.method,
    timestamp: Date.now(),
    headers: req.headers,
  });
  next();
});

// 修復版本：限制大小並定期清理
const requestLogs = [];
const MAX_LOGS = 10000;

app.use((req, res, next) => {
  requestLogs.push({
    url: req.url,
    method: req.method,
    timestamp: Date.now(),
  });

  // 超過上限時移除舊數據
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.splice(0, requestLogs.length - MAX_LOGS);
  }

  next();
});

// 定期清理超過 1 小時的日誌
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  while (requestLogs.length > 0 && requestLogs[0].timestamp < oneHourAgo) {
    requestLogs.shift();
  }
}, 60000);
```

## CPU 性能分析

### 使用 --prof 生成 V8 profiling 數據

```bash
# 生成日誌文件
node --prof app.js

# 處理日誌文件
node --prof-process isolate-*.log > processed.txt
```

### 使用 Chrome DevTools 進行 CPU Profiling

```bash
node --inspect app.js
```

在 Chrome DevTools 的 Profiler 面板中錄製 CPU profile，可以清楚看到每個函數的執行時間。

### 使用 clinic.js 自動診斷

```bash
npm install -g clinic

# CPU 診斷
clinic doctor -- node app.js

# 火焰圖分析
clinic flame -- node app.js

# 內存泄漏檢測
clinic heapprofiler -- node app.js
```

`clinic doctor` 會自動運行壓測並生成診斷報告，指出性能問題的可能原因。

## 事件循環優化

### 避免阻塞事件循環

```js
// 錯誤：在主線程同步處理大文件
app.post('/upload', (req, res) => {
  const data = fs.readFileSync(req.file.path);
  const processed = heavyProcessing(data); // 阻塞！
  res.json({ result: processed });
});

// 方案一：使用 setImmediate 分片處理
app.post('/upload', (req, res) => {
  const data = fs.readFileSync(req.file.path);
  processChunked(data, (err, result) => {
    res.json({ result });
  });
});

function processChunked(data, callback) {
  const chunkSize = 1000;
  let index = 0;
  const results = [];

  function processNextChunk() {
    const end = Math.min(index + chunkSize, data.length);

    for (; index < end; index++) {
      results.push(data[index] * 2); // 示例處理邏輯
    }

    if (index < data.length) {
      setImmediate(processNextChunk); // 讓出事件循環
    } else {
      callback(null, results);
    }
  }

  processNextChunk();
}

// 方案二：使用 Worker Thread（Node 10+）
const { Worker } = require('worker_threads');

app.post('/upload', (req, res) => {
  const worker = new Worker('./worker.js', {
    workerData: { filePath: req.file.path },
  });

  worker.on('message', (result) => res.json({ result }));
  worker.on('error', (err) => res.status(500).json({ error: err.message }));
});
```

### 監控事件循環延遲

```js
const { monitorEventLoopDelay } = require('perf_hooks');

// Node 11.10+ 支持
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

setInterval(() => {
  console.log({
    mean: `${(histogram.mean / 1e6).toFixed(2)} ms`,
    max: `${(histogram.max / 1e6).toFixed(2)} ms`,
    p99: `${(histogram.percentile(99) / 1e6).toFixed(2)} ms`,
  });
  histogram.reset();
}, 10000);
```

## GC 調優

### 調整 V8 堆大小

```bash
# 設置最大堆內存
node --max-old-space-size=4096 app.js  # 4GB

# 調整新生代大小
node --max-semi-space-size=16 app.js   # 16MB
```

### 減少 GC 壓力

```js
// 不好的實踐：頻繁創建臨時對象
function processItems(items) {
  return items.map(item => ({
    id: item.id,
    name: item.name,
    processed: true,
    timestamp: Date.now(),
  }));
}

// 好的實踐：複用對象
function processItemsInPlace(items) {
  for (let i = 0; i < items.length; i++) {
    items[i].processed = true;
    items[i].timestamp = Date.now();
  }
  return items;
}

// 對象池模式
class BufferPool {
  constructor(size) {
    this.pool = [];
    this.size = size;
    for (let i = 0; i < size; i++) {
      this.pool.push(Buffer.alloc(1024));
    }
  }

  acquire() {
    return this.pool.pop() || Buffer.alloc(1024);
  }

  release(buffer) {
    if (this.pool.length < this.size) {
      buffer.fill(0);
      this.pool.push(buffer);
    }
  }
}
```

## HTTP 性能優化

### 連接池複用

```js
const http = require('http');

// 配置 Agent 複用 TCP 連接
const agent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 256,
  maxFreeSockets: 256,
});

// 使用 agent
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    http.get({ ...options, agent }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
```

### 合理設置超時

```js
const server = http.createServer(app);

server.timeout = 30000;       // 請求超時 30s
server.keepAliveTimeout = 65000; // Keep-Alive 超時 65s（應大於 ALB 的值）
server.headersTimeout = 66000;   // 請求頭超時
```

## 集羣模式

使用 `cluster` 模塊利用多核 CPU：

```js
const cluster = require('cluster');
const os = require('os');
const http = require('http');

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  console.log(`主進程 ${process.pid}，啓動 ${numCPUs} 個工作進程`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`工作進程 ${worker.process.pid} 退出，重新啓動`);
    cluster.fork();
  });
} else {
  const app = require('./app');
  const server = http.createServer(app);

  server.listen(3000, () => {
    console.log(`工作進程 ${process.pid} 監聽端口 3000`);
  });
}
```

## 小結

- 內存泄漏三大常見原因：無限增長的緩存、未移除的事件監聽器、全局變量意外增長
- 使用 `clinic.js` 可以自動診斷 CPU、內存和事件循環問題
- 避免阻塞事件循環：大任務分片處理或使用 Worker Thread
- GC 調優的關鍵是減少臨時對象的創建，合理設置堆大小
- HTTP 性能優化：使用 Agent 複用連接、合理設置超時參數
- 生產環境使用 cluster 模式充分利用多核 CPU
- 定期進行壓力測試，使用監控工具持續關注 P95/P99 延遲
