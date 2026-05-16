---
title: "What's New in Node.js 12"
date: 2019-04-25 10:54:22
tags:
  - Node.js
readingTime: 1
description: "Node.js 12 was released last week (the LTS version won't be locked until October), and it comes with a lot of good stuff."
---

Node.js 12 was released last week (the LTS version won't be locked until October), and it comes with a lot of good stuff.

## V8 7.4: Faster JS Execution

- async/await is about 10× faster than before (no longer just syntactic sugar — there are actual engine optimizations)
- Private class fields support (a feature released simultaneously in Chrome 74)

```javascript
// Private fields (# prefix)
class BankAccount {
  #balance = 0; // not accessible from outside

  deposit(amount) {
    this.#balance += amount;
  }

  get balance() {
    return this.#balance;
  }
}

const account = new BankAccount();
account.deposit(1000);
console.log(account.balance); // 1000
console.log(account.#balance); // SyntaxError!
```

## TLS 1.3 Enabled by Default

```javascript
const https = require("https");
const fs = require("fs");

const server = https.createServer({
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
  minVersion: "TLSv1.2", // reject old TLS versions
});
```

## ES Modules Experimental Support (--experimental-modules)

```javascript
// package.json
{ "type": "module" }  // files are treated as ESM by default

// or use the .mjs extension
// utils.mjs
export function add(a, b) { return a + b }

// main.mjs
import { add } from './utils.mjs'
console.log(add(1, 2))
```

Node 12's ESM is still experimental and is not recommended for production. Node 14 is where it stabilizes.

## Increased Heap Memory Limit

```bash
# On 64-bit systems, Node 12 increases the default heap from 1.4 GB to ~4 GB
# Large applications no longer need to set this manually
node --max-old-space-size=4096 app.js  # previously required
```

## Diagnostic Reports

```bash
# Generate a process diagnostic report (CPU, memory, file handles, etc.)
node --experimental-report --report-on-signal app.js
kill -USR2 <pid>  # trigger the report
```
