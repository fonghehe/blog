---
title: "Node.js Stream 实战指南"
date: 2019-05-19 16:51:01
tags:
  - Node.js
readingTime: 6
description: "Stream 是 Node.js 最核心的模块之一，但很多开发者日常只用 `fs.readFile` 处理文件。当你需要处理大文件、构建管道式数据处理、或者实现高效 I/O 时，Stream 是不可或缺的工具。"
wordCount: 441
---

Stream 是 Node.js 最核心的模块之一，但很多开发者日常只用 `fs.readFile` 处理文件。当你需要处理大文件、构建管道式数据处理、或者实现高效 I/O 时，Stream 是不可或缺的工具。

## 为什么需要 Stream

先看一个常见问题：读取一个 2GB 的日志文件。

```javascript
// 方案一：fs.readFile — 一次性读入内存
const fs = require('fs')

fs.readFile('./huge-log.txt', (err, data) => {
  if (err) throw err
  console.log(data.length)
})

// 问题：2GB 文件需要 2GB 内存，很可能 OOM
// 即使 Node.js 的 Buffer 有 2GB 限制（v12+ 默认 4GB），效率也很低
```

```javascript
// 方案二：Stream — 分块读取，内存占用恒定
const fs = require('fs')

const stream = fs.createReadStream('./huge-log.txt', {
  encoding: 'utf8',
  highWaterMark: 64 * 1024 // 每次读取 64KB
})

let totalSize = 0
stream.on('data', (chunk) => {
  totalSize += chunk.length
  // 每次只处理 64KB，内存占用极低
})

stream.on('end', () => {
  console.log('总大小:', totalSize)
})

stream.on('error', (err) => {
  console.error('读取出错:', err)
})
```

Stream 把数据分成小块（chunk）处理，内存占用从 O(n) 变成 O(1)。

## Stream 的四种类型

```javascript
const { Readable, Writable, Duplex, Transform } = require('stream')
```

### Readable（可读流）

```javascript
const { Readable } = require('stream')

// 方式一：实现 _read 方法
class CounterStream extends Readable {
  constructor(max) {
    super({ encoding: 'utf8' })
    this.max = max
    this.current = 1
  }

  _read() {
    if (this.current > this.max) {
      this.push(null) // null 表示流结束
      return
    }
    // push 的数据会进入内部缓冲区
    this.push(`第 ${this.current} 行数据\n`)
    this.current++
  }
}

const counter = new CounterStream(5)
counter.on('data', (chunk) => {
  process.stdout.write(chunk)
})
// 输出：
// 第 1 行数据
// 第 2 行数据
// 第 3 行数据
// 第 4 行数据
// 第 5 行数据
```

```javascript
// 方式二：使用 Readable.from() 从迭代器创建
const { Readable } = require('stream')

async function* generateUsers() {
  const users = [
    { id: 1, name: '张三' },
    { id: 2, name: '李四' },
    { id: 3, name: '王五' }
  ]
  for (const user of users) {
    yield JSON.stringify(user)
  }
}

const userStream = Readable.from(generateUsers())
userStream.on('data', (chunk) => {
  console.log('收到:', chunk.toString())
})
```

### Writable（可写流）

```javascript
const { Writable } = require('stream')

// 实现 _write 方法
class LogWriter extends Writable {
  constructor(options) {
    super(options)
    this.logs = []
  }

  _write(chunk, encoding, callback) {
    const message = chunk.toString()
    this.logs.push({
      time: new Date().toISOString(),
      message: message.trim()
    })
    // callback 必须调用，表示当前 chunk 处理完成
    callback()
  }

  // 可选：处理批量写入
  _writev(chunks, callback) {
    for (const { chunk } of chunks) {
      this.logs.push({
        time: new Date().toISOString(),
        message: chunk.toString().trim()
      })
    }
    callback()
  }
}

const logger = new LogWriter()
logger.write('服务器启动\n')
logger.write('监听端口 3000\n')
logger.end(() => {
  console.log('日志:', logger.logs)
})
```

### Duplex（双工流）

Duplex 同时是 Readable 和 Writable，读写独立。

```javascript
const { Duplex } = require('stream')

class TCPStream extends Duplex {
  constructor(socket) {
    super()
    this.socket = socket
    this.buffer = []

    // socket 的数据推入可读端
    socket.on('data', (data) => {
      this.push(data)
    })

    socket.on('end', () => {
      this.push(null)
    })
  }

  // _write 处理写入端
  _write(chunk, encoding, callback) {
    this.socket.write(chunk, encoding, callback)
  }

  // _read 处理读取端（这里由 socket 事件驱动）
  _read() {
    // socket 的 data 事件已经通过 push() 提供数据
  }
}
```

### Transform（转换流）

Transform 是特殊的 Duplex，输入经过处理后输出。

```javascript
const { Transform } = require('stream')

// 实例一：大写转换
class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    // 将输入数据转为大写后推入输出
    this.push(chunk.toString().toUpperCase())
    callback()
  }
}

const upper = new UpperCaseTransform()
upper.on('data', (chunk) => {
  console.log(chunk.toString()) // 'HELLO WORLD'
})
upper.write('hello world')
upper.end()

// 实例二：JSON 行解析器
class JSONLineParser extends Transform {
  constructor() {
    super({ objectMode: true }) // 输出对象而非 Buffer
    this.buffer = ''
  }

  _transform(chunk, encoding, callback) {
    // 将新数据追加到缓冲区
    this.buffer += chunk.toString()

    // 按行分割
    const lines = this.buffer.split('\n')
    // 最后一行可能不完整，保留到下次
    this.buffer = lines.pop()

    for (const line of lines) {
      if (line.trim()) {
        try {
          this.push(JSON.parse(line))
        } catch (err) {
          this.emit('error', new Error(`JSON 解析失败: ${line}`))
        }
      }
    }

    callback()
  }

  _flush(callback) {
    // 处理最后一行
    if (this.buffer.trim()) {
      try {
        this.push(JSON.parse(this.buffer))
      } catch (err) {
        this.emit('error', new Error(`JSON 解析失败: ${this.buffer}`))
      }
    }
    callback()
  }
}

// 使用
const parser = new JSONLineParser()
parser.on('data', (obj) => {
  console.log('解析到对象:', obj)
})
parser.write('{"id":1,"name":"张三"}\n{"id":2,"name":"李四"}\n')
parser.end()
```

## pipe 和 pipeline

`pipe()` 是 Stream 的核心机制，将可读流连接到可写流。

```javascript
const fs = require('fs')

// 基本用法：复制文件
const readable = fs.createReadStream('./source.txt')
const writable = fs.createWriteStream('./dest.txt')

// pipe 自动处理：数据流、背压、结束传递
readable.pipe(writable)

writable.on('finish', () => {
  console.log('文件复制完成')
})
```

```javascript
// 链式管道：多个转换流串联
const fs = require('fs')
const zlib = require('zlib')
const crypto = require('crypto')

// 压缩 → 加密 → 写入文件
fs.createReadStream('./data.txt')
  .pipe(zlib.createGzip())
  .pipe(crypto.createCipheriv('aes-256-cbc', key, iv))
  .pipe(fs.createWriteStream('./data.txt.enc'))
  .on('finish', () => console.log('加密压缩完成'))

// 解压解密：反过来
fs.createReadStream('./data.txt.enc')
  .pipe(crypto.createDecipheriv('aes-256-cbc', key, iv))
  .pipe(zlib.createGunzip())
  .pipe(fs.createWriteStream('./data-restored.txt'))
  .on('finish', () => console.log('解密解压完成'))
```

`pipe()` 有一个问题：如果管道中间出错，上游不会自动关闭。Node.js 10+ 引入了 `pipeline` 解决这个问题。

```javascript
const { pipeline } = require('stream')
const fs = require('fs')
const zlib = require('zlib')

// pipeline 自动处理错误和资源清理
pipeline(
  fs.createReadStream('./input.txt'),
  zlib.createGzip(),
  fs.createWriteStream('./output.txt.gz'),
  (err) => {
    if (err) {
      console.error('管道出错:', err)
    } else {
      console.log('压缩完成')
    }
    // 无论成功还是失败，所有流都会被正确关闭
  }
)
```

## 背压（Backpressure）

背压是 Stream 处理速度不匹配时的自动调节机制。

```javascript
const fs = require('fs')

const readable = fs.createReadStream('./huge-file.txt', {
  highWaterMark: 64 * 1024  // 读取缓冲区 64KB
})

const writable = fs.createWriteStream('./output.txt', {
  highWaterMark: 16 * 1024  // 写入缓冲区 16KB
})

readable.on('data', (chunk) => {
  // writable.write() 返回 false 表示内部缓冲区已满
  const canContinue = writable.write(chunk)
  if (!canContinue) {
    // 暂停读取，等写入端清空缓冲区
    console.log('背压触发，暂停读取')
    readable.pause()

    writable.once('drain', () => {
      console.log('缓冲区清空，恢复读取')
      readable.resume()
    })
  }
})
```

好消息是 `pipe()` 自动处理了背压，这就是为什么推荐用 `pipe` 而不是手动处理 `data` 事件。

```javascript
// pipe 内部自动实现了上面的背压逻辑
readable.pipe(writable)
```

## 实战：大文件逐行处理

处理大型 CSV 或日志文件是最常见的 Stream 场景。

```javascript
const fs = require('fs')
const { Transform } = require('stream')
const { pipeline } = require('stream')

// 逐行读取流
class LineReader extends Transform {
  constructor() {
    super({ readableObjectMode: true })
    this.buffer = ''
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString()
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() // 保留最后一个不完整的行
    for (const line of lines) {
      this.push(line)
    }
    callback()
  }

  _flush(callback) {
    if (this.buffer) {
      this.push(this.buffer)
    }
    callback()
  }
}

// CSV 解析器
class CSVParser extends Transform {
  constructor(headers) {
    super({ writableObjectMode: true, readableObjectMode: true })
    this.headers = headers
    this.isFirstLine = !headers
  }

  _transform(line, encoding, callback) {
    if (this.isFirstLine) {
      this.headers = line.split(',').map(h => h.trim())
      this.isFirstLine = false
      callback()
      return
    }

    const values = line.split(',').map(v => v.trim())
    const obj = {}
    this.headers.forEach((header, i) => {
      obj[header] = values[i] || ''
    })
    this.push(obj)
    callback()
  }
}

// 数据过滤
class AgeFilter extends Transform {
  constructor(minAge) {
    super({ writableObjectMode: true, readableObjectMode: true })
    this.minAge = minAge
  }

  _transform(obj, encoding, callback) {
    const age = parseInt(obj.age, 10)
    if (!isNaN(age) && age >= this.minAge) {
      this.push(obj)
    }
    callback()
  }
}

// 数据转换为 JSON 行格式
class ToJSONLine extends Transform {
  constructor() {
    super({ writableObjectMode: true })
  }

  _transform(obj, encoding, callback) {
    this.push(JSON.stringify(obj) + '\n')
    callback()
  }
}

// 使用
pipeline(
  fs.createReadStream('./users.csv'),
  new LineReader(),
  new CSVParser(),     // 自动从第一行读取表头
  new AgeFilter(18),   // 过滤年龄 >= 18
  new ToJSONLine(),
  fs.createWriteStream('./adults.jsonl'),
  (err) => {
    if (err) console.error('处理出错:', err)
    else console.log('处理完成')
  }
)
```

## 实战：HTTP 请求流式下载

```javascript
const http = require('http')
const fs = require('fs')
const { Transform } = require('stream')
const { pipeline } = require('stream')

// 进度跟踪流
class ProgressTracker extends Transform {
  constructor(total) {
    super()
    this.transferred = 0
    this.total = total
    this.lastPercent = 0
  }

  _transform(chunk, encoding, callback) {
    this.transferred += chunk.length
    const percent = Math.floor((this.transferred / this.total) * 100)

    // 每 10% 输出一次进度
    if (percent >= this.lastPercent + 10) {
      this.lastPercent = percent
      console.log(`下载进度: ${percent}%`)
    }

    this.push(chunk)
    callback()
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: ${response.statusCode}`))
        return
      }

      const totalSize = parseInt(response.headers['content-length'], 10)

      pipeline(
        response,
        new ProgressTracker(totalSize),
        fs.createWriteStream(dest),
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )
    }).on('error', reject)
  })
}

// 使用
downloadFile('http://example.com/large-file.zip', './download.zip')
  .then(() => console.log('下载完成'))
  .catch(console.error)
```

## 实战：Express 中的流式响应

```javascript
const express = require('express')
const fs = require('fs')
const { Transform } = require('stream')
const { pipeline } = require('stream')
const path = require('path')

const app = express()

// 大文件下载：支持断点续传
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'files', req.params.filename)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' })
  }

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    // 断点续传
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunkSize = end - start + 1

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'application/octet-stream'
    })

    const stream = fs.createReadStream(filePath, { start, end })
    stream.pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'application/octet-stream'
    })
    fs.createReadStream(filePath).pipe(res)
  }
})

// 日志流式处理 API
app.get('/logs/search', (req, res) => {
  const keyword = req.query.keyword || ''
  const logFile = path.join(__dirname, 'logs', 'app.log')

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')

  // 边读取边搜索边返回，不需要把整个日志文件加载到内存
  class KeywordFilter extends Transform {
    _transform(chunk, encoding, callback) {
      const lines = chunk.toString().split('\n')
      for (const line of lines) {
        if (line.includes(keyword)) {
          this.push(line + '\n')
        }
      }
      callback()
    }
  }

  pipeline(
    fs.createReadStream(logFile, { encoding: 'utf8' }),
    new KeywordFilter(),
    res,
    (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: '搜索出错' })
      }
    }
  )
})
```

## Stream vs Buffer 对比

```javascript
// 方案一：Buffer — 读取整个文件
const fs = require('fs')

function processWithBuffer(filePath) {
  const start = Date.now()
  const data = fs.readFileSync(filePath)
  const lines = data.toString().split('\n')
  const result = lines.filter(line => line.includes('ERROR'))
  console.log(`Buffer 方式: 找到 ${result.length} 条错误，耗时 ${Date.now() - start}ms`)
  console.log(`内存占用: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`)
}

// 方案二：Stream — 流式处理
function processWithStream(filePath) {
  const start = Date.now()
  const { Transform, pipeline } = require('stream')

  let count = 0

  class ErrorCounter extends Transform {
    _transform(chunk, encoding, callback) {
      const lines = chunk.toString().split('\n')
      count += lines.filter(line => line.includes('ERROR')).length
      callback()
    }
  }

  return new Promise((resolve) => {
    pipeline(
      fs.createReadStream(filePath),
      new ErrorCounter(),
      fs.createWriteStream('/dev/null'), // 丢弃输出
      () => {
        console.log(`Stream 方式: 找到 ${count} 条错误，耗时 ${Date.now() - start}ms`)
        console.log(`内存占用: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`)
        resolve()
      }
    )
  })
}

// 对比结果（处理 500MB 日志文件）：
// Buffer 方式: 找到 12345 条错误，耗时 3200ms，内存占用 512 MB
// Stream 方式: 找到 12345 条错误，耗时 2800ms，内存占用 35 MB
```

## 小结

- Stream 把数据分成小块处理，内存占用从 O(n) 降到 O(1)，是处理大文件的首选方案
- 四种类型：Readable（可读）、Writable（可写）、Duplex（双工）、Transform（转换）
- `pipe()` 自动处理背压，推荐始终用 pipe 而非手动监听 data 事件
- Node.js 10+ 的 `pipeline()` 更安全，自动处理错误和资源清理
- 实际项目中 Stream 最适合大文件处理、日志分析、HTTP 流式响应等 I/O 密集场景
