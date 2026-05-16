---
title: "Practical Guide to Node.js Streams"
date: 2019-05-19 16:51:01
tags:
  - Node.js
readingTime: 1
description: "Streams are one of the most core modules in Node.js, but many developers only use `fs.readFile` for file processing on a daily basis. When you need to process l"
---

Streams are one of the most core modules in Node.js, but many developers only use `fs.readFile` for file processing on a daily basis. When you need to process large files, build pipeline-style data processing, or implement efficient I/O, Streams are an indispensable tool.

## Why You Need Streams

Consider a common problem: reading a 2 GB log file.

```javascript
// Option 1: fs.readFile — reads everything into memory at once
const fs = require("fs");

fs.readFile("./huge-log.txt", (err, data) => {
  if (err) throw err;
  console.log(data.length);
});

// Problem: a 2 GB file needs 2 GB of memory — likely to cause OOM
```

```javascript
// Option 2: Stream — reads in chunks, constant memory usage
const fs = require("fs");

const stream = fs.createReadStream("./huge-log.txt", {
  encoding: "utf8",
  highWaterMark: 64 * 1024, // read 64 KB at a time
});

let totalSize = 0;
stream.on("data", (chunk) => {
  totalSize += chunk.length;
  // only 64 KB in memory at a time
});

stream.on("end", () => {
  console.log("Total size:", totalSize);
});

stream.on("error", (err) => {
  console.error("Read error:", err);
});
```

Streams split data into small chunks, changing memory usage from O(n) to O(1).

## Four Types of Streams

```javascript
const { Readable, Writable, Duplex, Transform } = require("stream");
```

### Readable Stream

```javascript
const { Readable } = require("stream");

class CounterStream extends Readable {
  constructor(max) {
    super({ encoding: "utf8" });
    this.max = max;
    this.current = 1;
  }

  _read() {
    if (this.current > this.max) {
      this.push(null); // null signals end of stream
      return;
    }
    this.push(`Line ${this.current}\n`);
    this.current++;
  }
}

const counter = new CounterStream(5);
counter.pipe(process.stdout);
```

### Transform Stream

```javascript
const { Transform } = require("stream");

class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
}

// Pipeline: read file → uppercase → write file
const fs = require("fs");
fs.createReadStream("input.txt")
  .pipe(new UpperCaseTransform())
  .pipe(fs.createWriteStream("output.txt"));
```

## pipeline() — The Safe Way to Chain Streams

```javascript
const { pipeline } = require("stream");
const { promisify } = require("util");
const pipelineAsync = promisify(pipeline);

async function processFile() {
  await pipelineAsync(
    fs.createReadStream("input.txt"),
    new UpperCaseTransform(),
    fs.createWriteStream("output.txt"),
  );
  // pipeline automatically handles error propagation and cleanup
}
```

Use `pipeline` instead of manual `.pipe()` chains — it properly handles backpressure and error cleanup.
