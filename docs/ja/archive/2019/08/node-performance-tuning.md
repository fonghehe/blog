---
title: "Node.jsパフォーマンスチューニング実践"
date: 2019-08-26 09:47:22
tags:
  - パフォーマンス最適化
readingTime: 6
description: "サーバーサイドランタイムとしてのNode.jsにおいて、パフォーマンステューニングはリリース前に不可欠な工程だ。メモリリークの調査からイベントループの監視、CPUプロファイリングからGCパラメータ調整まで、Node.jsはパフォーマンスボトルネックの特定に役立つ豊富なツールチェーンを提供している。本記事では実際のケースを交え、Node.jsのパフォーマンスチューニングの方法論と実践テクニックを体系的に解説する。"
wordCount: 955
---

サーバーサイドランタイムとしてのNode.jsにおいて、パフォーマンステューニングはリリース前に不可欠な工程だ。メモリリークの調査からイベントループの監視、CPUプロファイリングからGCパラメータ調整まで、Node.jsはパフォーマンスボトルネックの特定に役立つ豊富なツールチェーンを提供している。本記事では実際のケースを交え、Node.jsのパフォーマンスチューニングの方法論と実践テクニックを体系的に解説する。

## パフォーマンス指標の概要

Node.jsアプリケーションで注目すべきコア指標：

- **レスポンスタイム（RT）** — P50、P95、P99 レイテンシ
- **スループット（QPS）** — 1秒あたりのリクエスト処理数
- **メモリ使用量** — RSS、ヒープメモリ、ヒープ外メモリ
- **CPU使用率** — シングルコア利用率、イベントループ遅延
- **GC頻度と所要時間** — ガベージコレクションがレスポンスタイムに与える影響

## メモリリークの調査

### メモリ使用量の監視

```js
// メモリ監視ミドルウェア
function memoryMonitor(req, res, next) {
  const mem = process.memoryUsage();

  console.log({
    rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
    heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
  });

  // メモリアラート
  const heapUsedMB = mem.heapUsed / 1024 / 1024;
  if (heapUsedMB > 500) {
    console.warn(`ヒープメモリが500MB超過: ${heapUsedMB.toFixed(2)} MB`);
  }

  next();
}
```

### --inspectを使ったヒープ解析

```bash
# 起動時にインスペクターを有効化
node --inspect=0.0.0.0:9229 app.js

# その後Chromeで chrome://inspect を開く
```

### よくあるメモリリークのパターン

**パターン1：クロージャが大きなオブジェクトへの参照を保持**

```js
// リーク版
const cache = {};

function handler(req, res) {
  const key = req.url;

  // キャッシュサイズを制限しないと無限に増え続ける
  cache[key] = {
    data: heavyComputation(),
    timestamp: Date.now(),
  };

  res.json(cache[key].data);
}

// 修正版：LRUキャッシュを使用
const LRU = require('lru-cache');
const cache = new LRU({
  max: 1000,                    // 最大キャッシュエントリ数
  maxAge: 1000 * 60 * 10,      // 10分で期限切れ
  length: (n) => n.data.length, // キャッシュ占有量の計算
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

**パターン2：イベントリスナーが削除されていない**

```js
// リーク版
function handleConnection(socket) {
  // 接続ごとにリスナーを追加するが、一度も削除しない
  socket.on('data', (data) => {
    processData(data);
  });

  // さらに悪いことに、外部オブジェクトにリスナーを登録
  globalEventEmitter.on('global-event', () => {
    // socketが閉じられた後もこのリスナーは残っている
    socket.write('event happened');
  });
}

// 修正版
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

**パターン3：グローバル変数の意図しない増加**

```js
// リーク版：无限制的全局数组
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

// 修正版：限制大小并定期清理
const requestLogs = [];
const MAX_LOGS = 10000;

app.use((req, res, next) => {
  requestLogs.push({
    url: req.url,
    method: req.method,
    timestamp: Date.now(),
  });

  // 上限超過時に古いデータを削除
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.splice(0, requestLogs.length - MAX_LOGS);
  }

  next();
});

// 1時間を超えたログを定期的にクリーンアップ
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  while (requestLogs.length > 0 && requestLogs[0].timestamp < oneHourAgo) {
    requestLogs.shift();
  }
}, 60000);
```

## CPUパフォーマンス分析

### --profでV8プロファイリングデータを生成

```bash
# ログファイルを生成
node --prof app.js

# ログファイルを処理
node --prof-process isolate-*.log > processed.txt
```

### Chrome DevToolsでのCPUプロファイリング

```bash
node --inspect app.js
```

Chrome DevToolsのProfilerパネルでCPUプロファイルを記録すると、各関数の実行時間を明確に確認できる。

### clinic.jsを使った自動診断

```bash
npm install -g clinic

# CPU診断
clinic doctor -- node app.js

# フレームグラフ解析
clinic flame -- node app.js

# メモリリーク検出
clinic heapprofiler -- node app.js
```

`clinic doctor` は自動的に負荷テストを実行し診断レポートを生成して、パフォーマンス問題の可能的な原因を指摘する。

## イベントループの最適化

### イベントループのブロック回避

```js
// 誤り：メインスレッドで大きなファイルを同期的に処理
app.post('/upload', (req, res) => {
  const data = fs.readFileSync(req.file.path);
  const processed = heavyProcessing(data); // 阻塞！
  res.json({ result: processed });
});

// 対策1：setImmediateで分割処理
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
      results.push(data[index] * 2); // サンプル処理ロジック
    }

    if (index < data.length) {
      setImmediate(processNextChunk); // イベントループに制御を譲る
    } else {
      callback(null, results);
    }
  }

  processNextChunk();
}

// 対策2：Worker Threadを使用（Node 10+）
const { Worker } = require('worker_threads');

app.post('/upload', (req, res) => {
  const worker = new Worker('./worker.js', {
    workerData: { filePath: req.file.path },
  });

  worker.on('message', (result) => res.json({ result }));
  worker.on('error', (err) => res.status(500).json({ error: err.message }));
});
```

### イベントループ遅延の監視

```js
const { monitorEventLoopDelay } = require('perf_hooks');

// Node 11.10+ でサポート
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

## GCチューニング

### V8ヒープサイズの設定

```bash
# 最大ヒープメモリを設定
node --max-old-space-size=4096 app.js  # 4GB

# 新世代領域のサイズ調整
node --max-semi-space-size=16 app.js   # 16MB
```

### GC負荷の軽減

```js
// 悪い例：一時オブジェクトを頻繁に生成
function processItems(items) {
  return items.map(item => ({
    id: item.id,
    name: item.name,
    processed: true,
    timestamp: Date.now(),
  }));
}

// 良い例：オブジェクトを再利用
function processItemsInPlace(items) {
  for (let i = 0; i < items.length; i++) {
    items[i].processed = true;
    items[i].timestamp = Date.now();
  }
  return items;
}

// オブジェクトプールパターン
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

## HTTPパフォーマンス最適化

### コネクションプールの再利用

```js
const http = require('http');

// Agentを設定してTCP接続を再利用
const agent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 256,
  maxFreeSockets: 256,
});

// agentを使用
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

### タイムアウトの適切な設定

```js
const server = http.createServer(app);

server.timeout = 30000;       // リクエストタイムアウト 30s
server.keepAliveTimeout = 65000; // Keep-Alive タイムアウト 65s（ALBの値より大きくすべき）
server.headersTimeout = 66000;   // リクエストヘッダータイムアウト
```

## クラスターモード

`cluster` モジュールを使ってマルチコアCPUを活用する：

```js
const cluster = require('cluster');
const os = require('os');
const http = require('http');

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  console.log(`マスタープロセス ${process.pid}、${numCPUs} 個のワーカープロセスを起動`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`ワーカープロセス ${worker.process.pid} が終了、再起動中`);
    cluster.fork();
  });
} else {
  const app = require('./app');
  const server = http.createServer(app);

  server.listen(3000, () => {
    console.log(`ワーカープロセス ${process.pid} がポート3000をリッスン`);
  });
}
```

## まとめ

- メモリリークの3大原因：無限に増えるキャッシュ、削除されていないイベントリスナー、グローバル変数の意図しない増加
- `clinic.js` を使えばCPU・メモリ・イベントループの問題を自動診断できる
- イベントループのブロックを避ける：大きなタスクは分割処理するかWorker Threadを使う
- GCチューニングの鍵は一時オブジェクトの生成を減らし、ヒープサイズを適切に設定すること
- HTTPパフォーマンス最適化：Agentで接続を再利用し、タイムアウトパラメータを適切に設定する
- 本番環境ではclusterモードを使ってマルチコアCPUを最大限に活用する
- 定期的に負荷テストを実施し、監視ツールでP95/P99レイテンシを継続的にチェックする
