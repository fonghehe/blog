---
title: "WebAssembly Component Model 與前端整合"
date: 2026-06-24 21:24:26
tags:
  - JavaScript
readingTime: 1
description: "WebAssembly Component Model 讓 WASM 模組可以呼叫其他模組的函數，實現了真正的模組化。本文討論 Component Model 的工作原理、前端整合方式和效能最佳化。"
wordCount: 239
---

WebAssembly Component Model 是 WASM 生態的重要進展。它讓不同的 WASM 模組可以互相呼叫，實現了真正的模組化和可組合性。

## Component Model 基礎

傳統的 WASM 模組是獨立的沙箱，無法直接呼叫其他模組的函數。Component Model 打破了這個限制：

```wit
// 介面定義（WIT 格式）
package example:math;

interface calculator {
  add: func(a: s32, b: s32) -> s32;
  multiply: func(a: s32, b: s32) -> s32;
}
```

```rust
// Rust 實現
use example::math::calculator::{add, multiply};

#[no_mangle]
pub extern "C" fn calculate(a: i32, b: i32) -> i32 {
    add(a, b) + multiply(a, b)
}
```

## 前端整合

**JavaScript 呼叫 WASM Component**

```javascript
// 載入 Component
const component = await WebAssembly.compileStreaming(
  fetch('/calculator.wasm')
);

// 建立實例
const instance = await WebAssembly.instantiate(component, {
  'example:math': {
    calculator: {
      add: (a, b) => a + b,
      multiply: (a, b) => a * b
    }
  }
});

// 呼叫函數
const result = instance.exports.calculate(2, 3);
console.log(result);  // 11
```

**React 整合**

```typescript
import { useState, useEffect } from 'react';

function Calculator() {
  const [wasm, setWasm] = useState<any>(null);
  
  useEffect(() => {
    async function loadWasm() {
      const component = await WebAssembly.compileStreaming(
        fetch('/calculator.wasm')
      );
      const instance = await WebAssembly.instantiate(component, {
        'example:math': {
          calculator: {
            add: (a: number, b: number) => a + b,
            multiply: (a: number, b: number) => a * b
          }
        }
      });
      setWasm(instance.exports);
    }
    loadWasm();
  }, []);
  
  if (!wasm) return <div>Loading...</div>;
  
  return (
    <div>
      <p>2 + 3 = {wasm.calculate(2, 3)}</p>
    </div>
  );
}
```

## 效能最佳化

**最佳化 1：減少邊界跨越**

```rust
// 不好的做法：頻繁呼叫
for i in 0..1000 {
    host_function(i);  // 1000 次邊界跨越
}

// 好的做法：批次處理
host_function_batch((0..1000).collect());  // 1 次邊界跨越
```

**最佳化 2：使用共享記憶體**

```javascript
const memory = new WebAssembly.Memory({
  initial: 256,
  maximum: 512,
  shared: true
});

// 多個 Component 共享同一塊記憶體
const instance1 = await WebAssembly.instantiate(component1, {
  env: { memory }
});
```

## 瀏覽器支援

| 瀏覽器 | 版本 | 狀態 |
|--------|------|------|
| Chrome | 110+ | 完全支援 |
| Firefox | 108+ | 完全支援 |
| Safari | 17+ | 完全支援 |
| Edge | 110+ | 完全支援 |

## 小結

WebAssembly Component Model 讓 WASM 模組可以互相呼叫，實現了真正的模組化。它提供了語言無關、類型安全、可組合的能力。2026 年的前端開發者應該了解 Component Model 的優勢，在需要高效能運算的場景下使用它。WASM 不是替代 JavaScript，而是補充。
