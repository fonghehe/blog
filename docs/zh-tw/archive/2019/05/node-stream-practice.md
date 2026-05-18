---
title: "Node.js Stream 實戰指南"
date: 2019-05-19 16:51:01
tags:
  - Node.js
readingTime: 6
description: "Stream 是 Node.js 最核心的模組之一，但很多開發者日常只用 `fs.readFile` 處理檔案。當你需要處理大檔案、構建管道式資料處理、或者實現高效 I/O 時，Stream 是不可或缺的工具。"
---

Stream 是 Node.js 最核心的模組之一，但很多開發者日常只用 `fs.readFile` 處理檔案。當你需要處理大檔案、構建管道式資料處理、或者實現高效 I/O 時，Stream 是不可或缺的工具。

## 為什麼需要 Stream

先看一個常見問題：讀取一個 2GB 的日誌檔案。

```javascript
// 方案一：fs.readFile — 一次性讀入記憶體
const fs = require('fs')

fs.readFile('./huge-log.txt', (err, data) => {
  if (err) throw err
  console.log(data.length)
})

// 問題：2GB 檔案需要 2GB 記憶體，很可能 OOM
// 即使 Node.js 的 Buffer 有 2GB 限制（v12+ 預設 4GB），效率也很低
```

```javascript
// 方案二：Stream — 分塊讀取，記憶體佔用恆定
const fs = require('fs')

const stream = fs.createReadStream('./huge-log.txt', {
  encoding: 'utf8',
  highWaterMark: 64 * 1024 // 每次讀取 64KB
})

let totalSize = 0
stream.on('data', (chunk) => {
  totalSize += chunk.length
  // 每次只處理 64KB，記憶體佔用極低
})

stream.on('end', () => {
  console.log('總大小:', totalSize)
})

stream.on('error', (err) => {
  console.error('讀取出錯:', err)
})
```

Stream 把資料分成小塊（chunk）處理，記憶體佔用從 O(n) 變成 O(1)。

## Stream 的四種類型

```javascript
const { Readable, Writable, Duplex, Transform } = require('stream')
```

### Readable（可讀流）

```javascript
const { Readable } = require('stream')

// 方式一：實現 _read 方法
class CounterStream extends Readable {
  constructor(max) {
    super({ encoding: 'utf8' })
    this.max = max
    this.current = 1
  }

  _read() {
    if (this.current > this.max) {
      this.push(null) // null 表示流結束
      return
    }
    // push 的資料會進入內部緩衝區
    this.push(`第 ${this.current} 行資料\n`)
    this.current++
  }
}

const counter = new CounterStream(5)
counter.on('data', (chunk) => {
  process.stdout.write(chunk)
})
// 輸出：
// 第 1 行資料
// 第 2 行資料
// 第 3 行資料
// 第 4 行資料
// 第 5 行資料
```

```javascript
// 方式二：使用 Readable.from() 從迭代器建立
const { Readable } = require('stream')

async function* generateUsers() {
  const users = [
    { id: 1, name: '張三' },
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

### Writable（可寫流）

```javascript
const { Writable } = require('stream')

// 實現 _write 方法
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
    // callback 必須呼叫，表示當前 chunk 處理完成
    callback()
  }

  // 可選：處理批次寫入
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
logger.write('伺服器啟動\n')
logger.write('監聽埠 3000\n')
logger.end(() => {
  console.log('日誌:', logger.logs)
})
```

### Duplex（雙工流）

Duplex 同時是 Readable 和 Writable，讀寫獨立。

```javascript
const { Duplex } = require('stream')

class TCPStream extends Duplex {
  constructor(socket) {
    super()
    this.socket = socket
    this.buffer = []

    // socket 的資料推入可讀端
    socket.on('data', (data) => {
      this.push(data)
    })

    socket.on('end', () => {
      this.push(null)
    })
  }

  // _write 處理寫入端
  _write(chunk, encoding, callback) {
    this.socket.write(chunk, encoding, callback)
  }

  // _read 處理讀取端（這裡由 socket 事件驅動）
  _read() {
    // socket 的 data 事件已經通過 push() 提供資料
  }
}
```

### Transform（轉換流）

Transform 是特殊的 Duplex，輸入經過處理後輸出。

```javascript
const { Transform } = require('stream')

// 例項一：大寫轉換
class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    // 將輸入資料轉為大寫後推入輸出
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

// 例項二：JSON 行解析器
class JSONLineParser extends Transform {
  constructor() {
    super({ objectMode: true }) // 輸出物件而非 Buffer
    this.buffer = ''
  }

  _transform(chunk, encoding, callback) {
    // 將新資料追加到緩衝區
    this.buffer += chunk.toString()

    // 按行分割
    const lines = this.buffer.split('\n')
    // 最後一行可能不完整，保留到下次
    this.buffer = lines.pop()

    for (const line of lines) {
      if (line.trim()) {
        try {
          this.push(JSON.parse(line))
        } catch (err) {
          this.emit('error', new Error(`JSON 解析失敗: ${line}`))
        }
      }
    }

    callback()
  }

  _flush(callback) {
    // 處理最後一行
    if (this.buffer.trim()) {
      try {
        this.push(JSON.parse(this.buffer))
      } catch (err) {
        this.emit('error', new Error(`JSON 解析失敗: ${this.buffer}`))
      }
    }
    callback()
  }
}

// 使用
const parser = new JSONLineParser()
parser.on('data', (obj) => {
  console.log('解析到物件:', obj)
})
parser.write('{"id":1,"name":"張三"}\n{"id":2,"name":"李四"}\n')
parser.end()
```

## pipe 和 pipeline

`pipe()` 是 Stream 的核心機制，將可讀流連線到可寫流。

```javascript
const fs = require('fs')

// 基本用法：複製檔案
const readable = fs.createReadStream('./source.txt')
const writable = fs.createWriteStream('./dest.txt')

// pipe 自動處理：資料流、背壓、結束傳遞
readable.pipe(writable)

writable.on('finish', () => {
  console.log('檔案複製完成')
})
```

```javascript
// 鏈式管道：多個轉換流串聯
const fs = require('fs')
const zlib = require('zlib')
const crypto = require('crypto')

// 壓縮 → 加密 → 寫入檔案
fs.createReadStream('./data.txt')
  .pipe(zlib.createGzip())
  .pipe(crypto.createCipheriv('aes-256-cbc', key, iv))
  .pipe(fs.createWriteStream('./data.txt.enc'))
  .on('finish', () => console.log('加密壓縮完成'))

// 解壓解密：反過來
fs.createReadStream('./data.txt.enc')
  .pipe(crypto.createDecipheriv('aes-256-cbc', key, iv))
  .pipe(zlib.createGunzip())
  .pipe(fs.createWriteStream('./data-restored.txt'))
  .on('finish', () => console.log('解密解壓完成'))
```

`pipe()` 有一個問題：如果管道中間出錯，上游不會自動關閉。Node.js 10+ 引入了 `pipeline` 解決這個問題。

```javascript
const { pipeline } = require('stream')
const fs = require('fs')
const zlib = require('zlib')

// pipeline 自動處理錯誤和資源清理
pipeline(
  fs.createReadStream('./input.txt'),
  zlib.createGzip(),
  fs.createWriteStream('./output.txt.gz'),
  (err) => {
    if (err) {
      console.error('管道出錯:', err)
    } else {
      console.log('壓縮完成')
    }
    // 無論成功還是失敗，所有流都會被正確關閉
  }
)
```

## 背壓（Backpressure）

背壓是 Stream 處理速度不匹配時的自動調節機制。

```javascript
const fs = require('fs')

const readable = fs.createReadStream('./huge-file.txt', {
  highWaterMark: 64 * 1024  // 讀取緩衝區 64KB
})

const writable = fs.createWriteStream('./output.txt', {
  highWaterMark: 16 * 1024  // 寫入緩衝區 16KB
})

readable.on('data', (chunk) => {
  // writable.write() 返回 false 表示內部緩衝區已滿
  const canContinue = writable.write(chunk)
  if (!canContinue) {
    // 暫停讀取，等寫入端清空緩衝區
    console.log('背壓觸發，暫停讀取')
    readable.pause()

    writable.once('drain', () => {
      console.log('緩衝區清空，恢復讀取')
      readable.resume()
    })
  }
})
```

好訊息是 `pipe()` 自動處理了背壓，這就是為什麼推薦用 `pipe` 而不是手動處理 `data` 事件。

```javascript
// pipe 內部自動實現了上面的背壓邏輯
readable.pipe(writable)
```

## 實戰：大檔案逐行處理

處理大型 CSV 或日誌檔案是最常見的 Stream 場景。

```javascript
const fs = require('fs')
const { Transform } = require('stream')
const { pipeline } = require('stream')

// 逐行讀取流
class LineReader extends Transform {
  constructor() {
    super({ readableObjectMode: true })
    this.buffer = ''
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString()
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() // 保留最後一個不完整的行
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

// 資料過濾
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

// 資料轉換為 JSON 行格式
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
  new CSVParser(),     // 自動從第一行讀取表頭
  new AgeFilter(18),   // 過濾年齡 >= 18
  new ToJSONLine(),
  fs.createWriteStream('./adults.jsonl'),
  (err) => {
    if (err) console.error('處理出錯:', err)
    else console.log('處理完成')
  }
)
```

## 實戰：HTTP 請求流式下載

```javascript
const http = require('http')
const fs = require('fs')
const { Transform } = require('stream')
const { pipeline } = require('stream')

// 進度跟蹤流
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

    // 每 10% 輸出一次進度
    if (percent >= this.lastPercent + 10) {
      this.lastPercent = percent
      console.log(`下載進度: ${percent}%`)
    }

    this.push(chunk)
    callback()
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      // 處理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下載失敗: ${response.statusCode}`))
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
  .then(() => console.log('下載完成'))
  .catch(console.error)
```

## 實戰：Express 中的流式響應

```javascript
const express = require('express')
const fs = require('fs')
const { Transform } = require('stream')
const { pipeline } = require('stream')
const path = require('path')

const app = express()

// 大檔案下載：支援斷點續傳
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'files', req.params.filename)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '檔案不存在' })
  }

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    // 斷點續傳
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

// 日誌流式處理 API
app.get('/logs/search', (req, res) => {
  const keyword = req.query.keyword || ''
  const logFile = path.join(__dirname, 'logs', 'app.log')

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')

  // 邊讀取邊搜尋邊返回，不需要把整個日誌檔案載入到記憶體
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
        res.status(500).json({ error: '搜尋出錯' })
      }
    }
  )
})
```

## Stream vs Buffer 對比

```javascript
// 方案一：Buffer — 讀取整個檔案
const fs = require('fs')

function processWithBuffer(filePath) {
  const start = Date.now()
  const data = fs.readFileSync(filePath)
  const lines = data.toString().split('\n')
  const result = lines.filter(line => line.includes('ERROR'))
  console.log(`Buffer 方式: 找到 ${result.length} 條錯誤，耗時 ${Date.now() - start}ms`)
  console.log(`記憶體佔用: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`)
}

// 方案二：Stream — 流式處理
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
      fs.createWriteStream('/dev/null'), // 丟棄輸出
      () => {
        console.log(`Stream 方式: 找到 ${count} 條錯誤，耗時 ${Date.now() - start}ms`)
        console.log(`記憶體佔用: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`)
        resolve()
      }
    )
  })
}

// 對比結果（處理 500MB 日誌檔案）：
// Buffer 方式: 找到 12345 條錯誤，耗時 3200ms，記憶體佔用 512 MB
// Stream 方式: 找到 12345 條錯誤，耗時 2800ms，記憶體佔用 35 MB
```

## 小結

- Stream 把資料分成小塊處理，記憶體佔用從 O(n) 降到 O(1)，是處理大檔案的首選方案
- 四種類型：Readable（可讀）、Writable（可寫）、Duplex（雙工）、Transform（轉換）
- `pipe()` 自動處理背壓，推薦始終用 pipe 而非手動監聽 data 事件
- Node.js 10+ 的 `pipeline()` 更安全，自動處理錯誤和資源清理
- 實際專案中 Stream 最適合大檔案處理、日誌分析、HTTP 流式響應等 I/O 密集場景
