---
title: "Node.js 性能调优实践"
date: 2019-08-26 09:47:22
tags:
  - 性能优化
readingTime: 4
description: "Node.js 作为服务端运行时，性能调优是上线前必不可少的环节。从内存泄漏排查到事件循环监控，从 CPU profiling 到 GC 调参，Node.js 提供了丰富的工具链帮助我们定位性能瓶颈。本文将结合实际案例，系统讲解 Node.js 性能调优的方法论和实践技巧。"
wordCount: 561
---

Node.js 作为服务端运行时，性能调优是上线前必不可少的环节。从内存泄漏排查到事件循环监控，从 CPU profiling 到 GC 调参，Node.js 提供了丰富的工具链帮助我们定位性能瓶颈。本文将结合实际案例，系统讲解 Node.js 性能调优的方法论和实践技巧。

## 性能指标概览

Node.js 应用需要关注的核心指标：

- **响应时间（RT）** — P50、P95、P99 延迟
- **吞吐量（QPS）** — 每秒处理的请求数
- **内存使用** — RSS、堆内存、堆外内存
- **CPU 使用率** — 单核利用率、事件循环延迟
- **GC 频率和耗时** — 垃圾回收对响应时间的影响

## 内存泄漏排查

### 监控内存使用

```js
// 内存监控中间件
function memoryMonitor(req, res, next) {
  const mem = process.memoryUsage();

  console.log({
    rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
    heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
  });

  // 内存告警
  const heapUsedMB = mem.heapUsed / 1024 / 1024;
  if (heapUsedMB > 500) {
    console.warn(`堆内存超过 500MB: ${heapUsedMB.toFixed(2)} MB`);
  }

  next();
}
```

### 使用 --inspect 进行堆分析

```bash
# 启动时开启 inspector
node --inspect=0.0.0.0:9229 app.js

# 然后在 Chrome 中打开 chrome://inspect
```

### 常见内存泄漏场景

**场景一：闭包持有大对象引用**

```js
// 泄漏版本
const cache = {};

function handler(req, res) {
  const key = req.url;

  // 如果不限制 cache 大小，会无限增长
  cache[key] = {
    data: heavyComputation(),
    timestamp: Date.now(),
  };

  res.json(cache[key].data);
}

// 修复版本：使用 LRU 缓存
const LRU = require('lru-cache');
const cache = new LRU({
  max: 1000,                    // 最大缓存条目数
  maxAge: 1000 * 60 * 10,      // 10 分钟过期
  length: (n) => n.data.length, // 计算缓存占用
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

**场景二：事件监听器未移除**

```js
// 泄漏版本
function handleConnection(socket) {
  // 每次连接都添加监听器，但从未移除
  socket.on('data', (data) => {
    processData(data);
  });

  // 更糟糕的是在外部对象上监听
  globalEventEmitter.on('global-event', () => {
    // socket 关闭后这个监听器仍然存在
    socket.write('event happened');
  });
}

// 修复版本
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

**场景三：全局变量意外增长**

```js
// 泄漏版本：无限制的全局数组
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

// 修复版本：限制大小并定期清理
const requestLogs = [];
const MAX_LOGS = 10000;

app.use((req, res, next) => {
  requestLogs.push({
    url: req.url,
    method: req.method,
    timestamp: Date.now(),
  });

  // 超过上限时移除旧数据
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.splice(0, requestLogs.length - MAX_LOGS);
  }

  next();
});

// 定期清理超过 1 小时的日志
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  while (requestLogs.length > 0 && requestLogs[0].timestamp < oneHourAgo) {
    requestLogs.shift();
  }
}, 60000);
```

## CPU 性能分析

### 使用 --prof 生成 V8 profiling 数据

```bash
# 生成日志文件
node --prof app.js

# 处理日志文件
node --prof-process isolate-*.log > processed.txt
```

### 使用 Chrome DevTools 进行 CPU Profiling

```bash
node --inspect app.js
```

在 Chrome DevTools 的 Profiler 面板中录制 CPU profile，可以清楚看到每个函数的执行时间。

### 使用 clinic.js 自动诊断

```bash
npm install -g clinic

# CPU 诊断
clinic doctor -- node app.js

# 火焰图分析
clinic flame -- node app.js

# 内存泄漏检测
clinic heapprofiler -- node app.js
```

`clinic doctor` 会自动运行压测并生成诊断报告，指出性能问题的可能原因。

## 事件循环优化

### 避免阻塞事件循环

```js
// 错误：在主线程同步处理大文件
app.post('/upload', (req, res) => {
  const data = fs.readFileSync(req.file.path);
  const processed = heavyProcessing(data); // 阻塞！
  res.json({ result: processed });
});

// 方案一：使用 setImmediate 分片处理
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
      results.push(data[index] * 2); // 示例处理逻辑
    }

    if (index < data.length) {
      setImmediate(processNextChunk); // 让出事件循环
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

### 监控事件循环延迟

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

## GC 调优

### 调整 V8 堆大小

```bash
# 设置最大堆内存
node --max-old-space-size=4096 app.js  # 4GB

# 调整新生代大小
node --max-semi-space-size=16 app.js   # 16MB
```

### 减少 GC 压力

```js
// 不好的实践：频繁创建临时对象
function processItems(items) {
  return items.map(item => ({
    id: item.id,
    name: item.name,
    processed: true,
    timestamp: Date.now(),
  }));
}

// 好的实践：复用对象
function processItemsInPlace(items) {
  for (let i = 0; i < items.length; i++) {
    items[i].processed = true;
    items[i].timestamp = Date.now();
  }
  return items;
}

// 对象池模式
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

## HTTP 性能优化

### 连接池复用

```js
const http = require('http');

// 配置 Agent 复用 TCP 连接
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

### 合理设置超时

```js
const server = http.createServer(app);

server.timeout = 30000;       // 请求超时 30s
server.keepAliveTimeout = 65000; // Keep-Alive 超时 65s（应大于 ALB 的值）
server.headersTimeout = 66000;   // 请求头超时
```

## 集群模式

使用 `cluster` 模块利用多核 CPU：

```js
const cluster = require('cluster');
const os = require('os');
const http = require('http');

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  console.log(`主进程 ${process.pid}，启动 ${numCPUs} 个工作进程`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`工作进程 ${worker.process.pid} 退出，重新启动`);
    cluster.fork();
  });
} else {
  const app = require('./app');
  const server = http.createServer(app);

  server.listen(3000, () => {
    console.log(`工作进程 ${process.pid} 监听端口 3000`);
  });
}
```

## 小结

- 内存泄漏三大常见原因：无限增长的缓存、未移除的事件监听器、全局变量意外增长
- 使用 `clinic.js` 可以自动诊断 CPU、内存和事件循环问题
- 避免阻塞事件循环：大任务分片处理或使用 Worker Thread
- GC 调优的关键是减少临时对象的创建，合理设置堆大小
- HTTP 性能优化：使用 Agent 复用连接、合理设置超时参数
- 生产环境使用 cluster 模式充分利用多核 CPU
- 定期进行压力测试，使用监控工具持续关注 P95/P99 延迟
