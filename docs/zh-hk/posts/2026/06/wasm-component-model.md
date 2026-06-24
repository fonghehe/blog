---
title: "WebAssembly Component Model 與前端集成"
date: 2026-06-24 21:24:26
tags:
  - JavaScript
readingTime: 1
description: "WebAssembly Component Model 讓 WASM 模塊可以調用其他模塊的函數，實現了真正的模塊化。本文討論 Component Model 的工作原理、前端集成方式和性能優化。"
wordCount: 235
---

WebAssembly Component Model 是 WASM 生態的重要進展。它讓不同的 WASM 模塊可以互相調用，實現了真正的模塊化和可組合性。

## Component Model 基礎

傳統的 WASM 模塊是獨立的沙箱，無法直接調用其他模塊的函數。Component Model 打破了這個限制：

```wit
// 接口定義（WIT 格式）
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

## 前端集成

**JavaScript 調用 WASM Component**

```javascript
// 加載 Component
const component = await WebAssembly.compileStreaming(
  fetch('/calculator.wasm')
);

// 創建實例
const instance = await WebAssembly.instantiate(component, {
  'example:math': {
    calculator: {
      add: (a, b) => a + b,
      multiply: (a, b) => a * b
    }
  }
});

// 調用函數
const result = instance.exports.calculate(2, 3);
console.log(result);  // 11
```

**React 集成**

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

## 性能優化

**優化 1：減少邊界跨越**

```rust
// 不好的做法：頻繁調用
for i in 0..1000 {
    host_function(i);  // 1000 次邊界跨越
}

// 好的做法：批量處理
host_function_batch((0..1000).collect());  // 1 次邊界跨越
```

**優化 2：使用共享內存**

```javascript
const memory = new WebAssembly.Memory({
  initial: 256,
  maximum: 512,
  shared: true
});

// 多個 Component 共享同一塊內存
const instance1 = await WebAssembly.instantiate(component1, {
  env: { memory }
});
```

## 瀏覽器支持

| 瀏覽器 | 版本 | 狀態 |
|--------|------|------|
| Chrome | 110+ | 完全支持 |
| Firefox | 108+ | 完全支持 |
| Safari | 17+ | 完全支持 |
| Edge | 110+ | 完全支持 |

## 總結

WebAssembly Component Model 讓 WASM 模塊可以互相調用，實現了真正的模塊化。它提供了語言無關、類型安全、可組合的能力。2026 年的前端開發者應該了解 Component Model 的優勢，在需要高性能計算的場景下使用它。WASM 不是替代 JavaScript，而是補充。
