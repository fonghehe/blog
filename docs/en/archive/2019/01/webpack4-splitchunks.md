---
title: "Webpack 4 SplitChunks Explained"
date: 2019-01-23 10:11:08
tags:
  - Webpack
  - Engineering
readingTime: 1
description: "Promoting Webpack 4 SplitChunks within the team came with plenty of pitfalls. Documenting them here in the hope it helps others."
wordCount: 125
---

Promoting Webpack 4 SplitChunks within the team came with plenty of pitfalls. Documenting them here in the hope it helps others.

## Core Principles

Here is the core code:

```javascript
:root {
  --primary: #3498db;
  --bg: #fff;
  --text: #333;
}

[data-theme='dark'] {
  --primary: #5dade2;
  --bg: #1a1a2e;
  --text: #eee;
}

body {
  background: var(--bg);
  color: var(--text);
  transition: background 0.3s, color 0.3s;
}
```

In real projects, you also need to consider edge cases and error handling.

## Source Analysis

Here is a real-world example:

```javascript
const express = require("express");
const app = express();

// Middleware
app.use(express.json());

function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === "production" ? "Server Error" : err.message,
  });
}

app.get("/api/users", async (req, res, next) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);
```

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Practical Application

This can be achieved with the following approach:

```javascript
const http = require("http");
const cluster = require("cluster");
const os = require("os");

if (cluster.isMaster) {
  const numWorkers = os.cpus().length;
  console.log(`Master process ${process.pid}, starting ${numWorkers} workers`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} exited, restarting`);
    cluster.fork();
  });
} else {
  http
    .createServer((req, res) => {
      res.end(`Worker ${process.pid}`);
    })
    .listen(3000);
}
```

Pay attention to the performance details in the code above and avoid unnecessary computation.

## Summary

- Choose the right approach for the scenario in real projects
- Establishing team-wide conventions matters more than pursuing perfect implementations
- Keep learning and summarizing; stay technically sharp
- When in doubt, read the source code and official documentation
