---
title: "JavaScript 模組化演進史：從 IIFE 到 ES Modules"
date: 2019-06-10 10:39:59
tags:
  - JavaScript
readingTime: 7
description: "JavaScript 在誕生之初並沒有模組系統，所有程式碼共享同一個全域性作用域。隨著前端專案規模的增長，模組化方案經歷了 IIFE、CommonJS、AMD、UMD、ES Modules 的演變。理解這段歷史，能幫助我們在實際專案中做出更好的選擇。"
---

JavaScript 在誕生之初並沒有模組系統，所有程式碼共享同一個全域性作用域。隨著前端專案規模的增長，模組化方案經歷了 IIFE、CommonJS、AMD、UMD、ES Modules 的演變。理解這段歷史，能幫助我們在實際專案中做出更好的選擇。

## 原始時代：全域性變數

最早期的前端開發，所有 JS 檔案通過 `<script>` 標籤引入，所有變數都掛在 `window` 上：

```html
<!-- index.html -->
<script src="jquery.js"></script>
<script src="utils.js"></script>
<script src="app.js"></script>
<!-- 問題：utils.js 和 app.js 共享全域性作用域，
     變數名衝突是家常便飯 -->
```

```javascript
// utils.js —— 全域性汙染
var name = 'utils';
function add(a, b) {
  return a + b;
}

// app.js —— name 被覆蓋了！
var name = 'app'; // 覆蓋了 utils.js 中的 name
console.log(name); // 'app'
```

這種模式的痛點顯而易見：命名衝突、依賴關係不明確、程式碼組織混亂。

## IIFE：最早的模組化方案

IIFE（Immediately Invoked Function Expression，立即執行函式表示式）利用函式作用域來隔離變數：

```javascript
// 模組定義：用 IIFE 包裹，建立獨立作用域
var myModule = (function() {
  // 私有變數：外部無法訪問
  var privateVar = 'I am private';
  var counter = 0;

  // 私有函式
  function privateMethod() {
    console.log('私有方法被呼叫');
    counter++;
  }

  // 返回公共 API（閉包）
  return {
    // 公共方法
    increment: function() {
      privateMethod();
      return counter;
    },
    getCount: function() {
      return counter;
    },
    // 公共變數
    name: 'myModule'
  };
})();

// 使用
myModule.increment(); // '私有方法被呼叫'
myModule.increment();
myModule.getCount();  // 2
myModule.privateVar;  // undefined —— 訪問不到
```

IIFE 還支援「依賴注入」模式，jQuery 外掛大量使用這種寫法：

```javascript
// 傳入依賴作為引數，避免全域性查詢
var myPlugin = (function($, utils) {
  // $ 是 jQuery，utils 是另一個模組
  // 都通過引數傳入，不依賴全域性變數

  return {
    init: function(selector) {
      var elements = $(selector);
      elements.each(function() {
        utils.addClass(this, 'initialized');
      });
    }
  };
})(jQuery, myUtils);
// ↑ 立即執行，傳入依賴
```

IIFE 解決了作用域隔離的問題，但模組的載入順序仍然需要手動管理，而且多個模組之間的依賴關係很不直觀。

## CommonJS：Node.js 的模組標準

2009 年 Node.js 誕生，帶來了 CommonJS 規範。它用 `require` 匯入、`module.exports` 匯出，是同步載入的：

```javascript
// math.js —— 定義模組
// module.exports 匯出整個模組
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

// 方式一：匯出整個物件
module.exports = {
  add: add,
  subtract: subtract,
  multiply: multiply
};

// 方式二：逐個掛載到 exports 上
// 注意：不能直接賦值 exports = {...}，這會斷開引用
// exports.add = add;
// exports.subtract = subtract;
```

```javascript
// app.js —— 使用模組
var math = require('./math');
// 注意：require 是同步的，執行到這裡會阻塞，
// 直到 math.js 載入並執行完畢

console.log(math.add(1, 2));      // 3
console.log(math.subtract(5, 3)); // 2

// 也可以解構匯入
var { add, subtract } = require('./math');
console.log(add(10, 20)); // 30
```

CommonJS 的一個重要特性是**模組快取**：

```javascript
// moduleA.js
console.log('moduleA 被載入了');
module.exports = { loaded: true };

// file1.js
var a = require('./moduleA'); // 輸出: "moduleA 被載入了"

// file2.js
var a = require('./moduleA'); // 不會再輸出，直接從快取中讀取

// file1.js 和 file2.js 拿到的是同一個物件
var a1 = require('./moduleA');
var a2 = require('./moduleA');
console.log(a1 === a2); // true
```

CommonJS 的問題：它是同步載入的，在瀏覽器端使用時，網路請求會阻塞頁面渲染。所以瀏覽器端需要非同步的模組方案。

## AMD：瀏覽器端的非同步模組

AMD（Asynchronous Module Definition）專為瀏覽器設計，核心是非同步載入模組：

```javascript
// math.js —— 用 AMD 定義模組
// 第一個引數是模組名（可選），第二個引數是依賴陣列，第三個是工廠函式
define('math', [], function() {
  return {
    add: function(a, b) {
      return a + b;
    },
    subtract: function(a, b) {
      return a - b;
    }
  };
});
```

```javascript
// calculator.js —— 依賴 math 模組
// 依賴會在回撥之前全部載入完畢
define('calculator', ['math'], function(math) {
  return {
    calculate: function(a, b, op) {
      switch (op) {
        case '+': return math.add(a, b);
        case '-': return math.subtract(a, b);
        default: return 0;
      }
    }
  };
});
```

```javascript
// app.js —— 入口檔案，使用 RequireJS 載入
require(['calculator'], function(calculator) {
  var result = calculator.calculate(10, 5, '+');
  console.log(result); // 15
});
```

AMD 還支援 CommonJS 風格的寫法（也叫 Simplified CommonJS Wrapper）：

```javascript
// 動態載入模組（按需載入）
define('dynamicModule', ['require', 'exports', 'module'], function(require, exports, module) {
  // 可以像 CommonJS 一樣使用 require
  var math = require('./math');

  // 條件載入
  if (window.needsAdvanced) {
    var advanced = require('./advancedMath');
  }

  module.exports = {
    compute: function(x) {
      return math.add(x, 1);
    }
  };
});
```

AMD 的問題：語法比較繁瑣，依賴前置（所有依賴必須在回撥之前宣告），而且隨著構建工具的發展，「先下載再執行」的優勢不再明顯。

## UMD：相容一切的通用方案

UMD（Universal Module Definition）不是一種新的模組規範，而是一種相容模式——讓同一個模組在 AMD、CommonJS、瀏覽器全域性變數環境下都能工作：

```javascript
// utils.js —— UMD 格式
(function(root, factory) {
  // 檢測環境，選擇合適的模組載入方式
  if (typeof define === 'function' && define.amd) {
    // AMD 環境（RequireJS）
    define('utils', [], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS 環境（Node.js / Browserify / Webpack）
    module.exports = factory();
  } else {
    // 瀏覽器全域性變數
    root.MyUtils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  // 模組的真正實現
  return {
    formatDate: function(date) {
      var d = new Date(date);
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    },
    debounce: function(fn, delay) {
      var timer = null;
      return function() {
        var context = this;
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() {
          fn.apply(context, args);
        }, delay);
      };
    }
  };
}));
```

UMD 在 npm 包的 `dist` 目錄中非常常見。當我們引入一個第三方庫的 UMD 版本時，它在任何環境下都能正常工作。但 UMD 的問題是程式碼冗餘——每個模組都帶著一長串環境檢測程式碼。

## ES Modules：語言原生標準

ES6（ES2015）終於在語言層面提供了原生的模組系統——ES Modules。它使用 `import` / `export` 語法，靜態分析友好，是現代前端的主流方案：

```javascript
// math.js —— ES Module 匯出
// 命名匯出（named export）：可以匯出多個
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// 匯出常量
export const PI = 3.14159265;

// 也可以先定義，最後統一匯出
const multiply = (a, b) => a * b;
const divide = (a, b) => b !== 0 ? a / b : null;

export { multiply, divide };
```

```javascript
// logger.js —— 預設匯出（default export）：每個模組只能有一個
export default class Logger {
  constructor(prefix) {
    this.prefix = prefix;
  }

  log(message) {
    console.log(`[${this.prefix}] ${message}`);
  }

  error(message) {
    console.error(`[${this.prefix}] ERROR: ${message}`);
  }
}
```

```javascript
// app.js —— ES Module 匯入
// 匯入命名匯出
import { add, subtract, PI } from './math.js';

// 匯入預設匯出
import Logger from './logger.js';

// 匯入整個模組作為名稱空間物件
import * as MathUtils from './math.js';
console.log(MathUtils.add(1, 2));     // 3
console.log(MathUtils.subtract(5, 3)); // 2
console.log(MathUtils.PI);            // 3.14159265

// 使用
const logger = new Logger('App');
logger.log('應用啟動');
logger.log(`1 + 2 = ${add(1, 2)}`);
```

ES Modules 有幾個重要的特性是之前方案不具備的：

```javascript
// 1. 靜態分析：import 必須在頂層，不能在條件語句或函式中
// 這使得構建工具可以在編譯時分析依賴關係

// ❌ 不合法的寫法
if (condition) {
  import { something } from './module.js'; // SyntaxError
}

// 2. 匯出是即時繫結（live binding），不是值複製
// counter.js
export let count = 0;
export function increment() {
  count++;
}

// app.js
import { count, increment } from './counter.js';
console.log(count); // 0
increment();
// count 會即時反映模組內部的變化
console.log(count); // 1

// 3. 模組預設是嚴格模式，不需要手動寫 'use strict'
// 4. 模組有自己的作用域，頂層的 this 是 undefined
```

## 動態 import()

ES Modules 的 `import` 是靜態的，但實際場景中我們經常需要按條件載入模組。ES2020 提案引入了 `import()` 函式：

```javascript
// 場景一：路由懶載入
const routes = [
  {
    path: '/home',
    component: () => import('./pages/Home.js')
  },
  {
    path: '/about',
    component: () => import('./pages/About.js')
  },
  {
    path: '/dashboard',
    // 只有登入使用者才載入 Dashboard
    component: () => {
      if (isLoggedIn()) {
        return import('./pages/Dashboard.js');
      }
      return import('./pages/Login.js');
    }
  }
];

// 場景二：按需載入大型庫
async function exportToExcel(data) {
  // 只在使用者點選「匯出」時才載入 xlsx 庫
  const XLSX = await import('xlsx');

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, 'export.xlsx');
}

// 場景三：錯誤重試
async function loadModuleWithRetry(modulePath, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const module = await import(modulePath);
      return module;
    } catch (error) {
      console.warn(`載入失敗，第 ${i + 1} 次重試...`, error);
      if (i === retries - 1) throw error;
    }
  }
}

// 場景四：條件匯入不同的實現
async function getStorage() {
  if (typeof window !== 'undefined' && window.indexedDB) {
    const { IndexedDBStorage } = await import('./storage/indexeddb.js');
    return new IndexedDBStorage();
  } else {
    const { LocalStorage } = await import('./storage/localstorage.js');
    return new LocalStorage();
  }
}
```

`import()` 返回一個 Promise，解析值是模組的名稱空間物件（包含所有命名匯出和 `default`）。

## Webpack 中的模組打包

Webpack 是 2019 年最主流的模組打包工具。它支援所有上述模組規範，並將它們統一打包：

```javascript
// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    // 入口：從這裡開始分析依賴
    main: './src/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
  },
  // 程式碼分割配置
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // 第三方庫單獨打包
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        // 公共模組提取
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
  ],
};
```

```javascript
// src/index.js —— 專案入口
// Webpack 能識別所有模組格式，但推薦使用 ES Modules
import { add } from './utils/math';
import('./pages/Home').then(({ default: Home }) => {
  // 動態 import 會被 Webpack 自動分割為獨立的 chunk
  const home = new Home();
  home.render();
});

console.log(add(1, 2));
```

```javascript
// src/utils/math.js
// Tree Shaking 的關鍵：使用 ES Modules 的命名匯出
// Webpack 可以在構建時分析出哪些匯出沒有被使用，然後剔除它們

export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// 如果專案中沒有使用 multiply，
// Webpack 的 tree shaking 會把它從最終產物中移除
export function multiply(a, b) {
  return a * b;
}

// ⚠️ 注意：CommonJS 的 module.exports 不支援 tree shaking
// 因為它是執行時的動態賦值，構建工具無法靜態分析
```

```javascript
// tree shaking 示例
// index.js
import { add } from './math';
// multiply 沒有被匯入，webpack 會將它從產物中移除

// 最終產物中只包含 add 函式的程式碼
// subtract 和 multiply 都不會被打包進來
```

## 各模組方案對比

```
         作用域隔離   非同步載入   靜態分析   瀏覽器支援   Node支援   Tree Shaking
IIFE       ✅          ❌         ❌         ✅          ✅         ❌
CommonJS   ✅          ❌         ❌         ❌*         ✅         ❌
AMD        ✅          ✅         ❌         ✅          ❌         ❌
UMD        ✅          ✅         ❌         ✅          ✅         ❌
ESM        ✅          ✅         ✅         ✅**        ✅***      ✅

* CommonJS 在瀏覽器端需要 Browserify/Webpack 轉換
** 現代瀏覽器原生支援 <script type="module">
*** Node.js 12+ 開始原生支援 ES Modules
```

```html
<!-- 瀏覽器原生使用 ES Modules -->
<script type="module" src="./app.js"></script>

<!-- 注意：type="module" 預設就是 defer 的 -->
<!-- 也可以內聯 -->
<script type="module">
  import { add } from './math.js';
  console.log(add(1, 2));
</script>

<!-- 降級方案：用 nomodule 給不支援 ES Module 的舊瀏覽器提供打包版本 -->
<script nomodule src="./legacy-bundle.js"></script>
```

## 小結

- JavaScript 模組化經歷了 IIFE → CommonJS → AMD → UMD → ES Modules 的演進，每次演進都是為了解決前一代方案的核心痛點
- IIFE 用函式作用域隔離變數，但依賴手動管理載入順序；CommonJS 是 Node.js 的同步方案，不適合瀏覽器直接使用
- AMD 為瀏覽器設計了非同步載入，但語法繁瑣；UMD 相容所有環境但程式碼冗餘
- ES Modules 是語言原生標準，靜態分析友好，支援 tree shaking 和動態 `import()`，是現代前端的首選方案
- 實際專案中通過 Webpack 等構建工具打包，利用動態 `import()` 實現程式碼分割，ES Modules 的靜態特性讓 tree shaking 成為可能
