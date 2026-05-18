---
title: "JavaScript 模块化演进史：从 IIFE 到 ES Modules"
date: 2019-06-10 10:39:59
tags:
  - JavaScript
readingTime: 7
description: "JavaScript 在诞生之初并没有模块系统，所有代码共享同一个全局作用域。随着前端项目规模的增长，模块化方案经历了 IIFE、CommonJS、AMD、UMD、ES Modules 的演变。理解这段历史，能帮助我们在实际项目中做出更好的选择。"
---

JavaScript 在诞生之初并没有模块系统，所有代码共享同一个全局作用域。随着前端项目规模的增长，模块化方案经历了 IIFE、CommonJS、AMD、UMD、ES Modules 的演变。理解这段历史，能帮助我们在实际项目中做出更好的选择。

## 原始时代：全局变量

最早期的前端开发，所有 JS 文件通过 `<script>` 标签引入，所有变量都挂在 `window` 上：

```html
<!-- index.html -->
<script src="jquery.js"></script>
<script src="utils.js"></script>
<script src="app.js"></script>
<!-- 问题：utils.js 和 app.js 共享全局作用域，
     变量名冲突是家常便饭 -->
```

```javascript
// utils.js —— 全局污染
var name = 'utils';
function add(a, b) {
  return a + b;
}

// app.js —— name 被覆盖了！
var name = 'app'; // 覆盖了 utils.js 中的 name
console.log(name); // 'app'
```

这种模式的痛点显而易见：命名冲突、依赖关系不明确、代码组织混乱。

## IIFE：最早的模块化方案

IIFE（Immediately Invoked Function Expression，立即执行函数表达式）利用函数作用域来隔离变量：

```javascript
// 模块定义：用 IIFE 包裹，创建独立作用域
var myModule = (function() {
  // 私有变量：外部无法访问
  var privateVar = 'I am private';
  var counter = 0;

  // 私有函数
  function privateMethod() {
    console.log('私有方法被调用');
    counter++;
  }

  // 返回公共 API（闭包）
  return {
    // 公共方法
    increment: function() {
      privateMethod();
      return counter;
    },
    getCount: function() {
      return counter;
    },
    // 公共变量
    name: 'myModule'
  };
})();

// 使用
myModule.increment(); // '私有方法被调用'
myModule.increment();
myModule.getCount();  // 2
myModule.privateVar;  // undefined —— 访问不到
```

IIFE 还支持「依赖注入」模式，jQuery 插件大量使用这种写法：

```javascript
// 传入依赖作为参数，避免全局查找
var myPlugin = (function($, utils) {
  // $ 是 jQuery，utils 是另一个模块
  // 都通过参数传入，不依赖全局变量

  return {
    init: function(selector) {
      var elements = $(selector);
      elements.each(function() {
        utils.addClass(this, 'initialized');
      });
    }
  };
})(jQuery, myUtils);
// ↑ 立即执行，传入依赖
```

IIFE 解决了作用域隔离的问题，但模块的加载顺序仍然需要手动管理，而且多个模块之间的依赖关系很不直观。

## CommonJS：Node.js 的模块标准

2009 年 Node.js 诞生，带来了 CommonJS 规范。它用 `require` 导入、`module.exports` 导出，是同步加载的：

```javascript
// math.js —— 定义模块
// module.exports 导出整个模块
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

// 方式一：导出整个对象
module.exports = {
  add: add,
  subtract: subtract,
  multiply: multiply
};

// 方式二：逐个挂载到 exports 上
// 注意：不能直接赋值 exports = {...}，这会断开引用
// exports.add = add;
// exports.subtract = subtract;
```

```javascript
// app.js —— 使用模块
var math = require('./math');
// 注意：require 是同步的，执行到这里会阻塞，
// 直到 math.js 加载并执行完毕

console.log(math.add(1, 2));      // 3
console.log(math.subtract(5, 3)); // 2

// 也可以解构导入
var { add, subtract } = require('./math');
console.log(add(10, 20)); // 30
```

CommonJS 的一个重要特性是**模块缓存**：

```javascript
// moduleA.js
console.log('moduleA 被加载了');
module.exports = { loaded: true };

// file1.js
var a = require('./moduleA'); // 输出: "moduleA 被加载了"

// file2.js
var a = require('./moduleA'); // 不会再输出，直接从缓存中读取

// file1.js 和 file2.js 拿到的是同一个对象
var a1 = require('./moduleA');
var a2 = require('./moduleA');
console.log(a1 === a2); // true
```

CommonJS 的问题：它是同步加载的，在浏览器端使用时，网络请求会阻塞页面渲染。所以浏览器端需要异步的模块方案。

## AMD：浏览器端的异步模块

AMD（Asynchronous Module Definition）专为浏览器设计，核心是异步加载模块：

```javascript
// math.js —— 用 AMD 定义模块
// 第一个参数是模块名（可选），第二个参数是依赖数组，第三个是工厂函数
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
// calculator.js —— 依赖 math 模块
// 依赖会在回调之前全部加载完毕
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
// app.js —— 入口文件，使用 RequireJS 加载
require(['calculator'], function(calculator) {
  var result = calculator.calculate(10, 5, '+');
  console.log(result); // 15
});
```

AMD 还支持 CommonJS 风格的写法（也叫 Simplified CommonJS Wrapper）：

```javascript
// 动态加载模块（按需加载）
define('dynamicModule', ['require', 'exports', 'module'], function(require, exports, module) {
  // 可以像 CommonJS 一样使用 require
  var math = require('./math');

  // 条件加载
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

AMD 的问题：语法比较繁琐，依赖前置（所有依赖必须在回调之前声明），而且随着构建工具的发展，「先下载再执行」的优势不再明显。

## UMD：兼容一切的通用方案

UMD（Universal Module Definition）不是一种新的模块规范，而是一种兼容模式——让同一个模块在 AMD、CommonJS、浏览器全局变量环境下都能工作：

```javascript
// utils.js —— UMD 格式
(function(root, factory) {
  // 检测环境，选择合适的模块加载方式
  if (typeof define === 'function' && define.amd) {
    // AMD 环境（RequireJS）
    define('utils', [], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS 环境（Node.js / Browserify / Webpack）
    module.exports = factory();
  } else {
    // 浏览器全局变量
    root.MyUtils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  // 模块的真正实现
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

UMD 在 npm 包的 `dist` 目录中非常常见。当我们引入一个第三方库的 UMD 版本时，它在任何环境下都能正常工作。但 UMD 的问题是代码冗余——每个模块都带着一长串环境检测代码。

## ES Modules：语言原生标准

ES6（ES2015）终于在语言层面提供了原生的模块系统——ES Modules。它使用 `import` / `export` 语法，静态分析友好，是现代前端的主流方案：

```javascript
// math.js —— ES Module 导出
// 命名导出（named export）：可以导出多个
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// 导出常量
export const PI = 3.14159265;

// 也可以先定义，最后统一导出
const multiply = (a, b) => a * b;
const divide = (a, b) => b !== 0 ? a / b : null;

export { multiply, divide };
```

```javascript
// logger.js —— 默认导出（default export）：每个模块只能有一个
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
// app.js —— ES Module 导入
// 导入命名导出
import { add, subtract, PI } from './math.js';

// 导入默认导出
import Logger from './logger.js';

// 导入整个模块作为命名空间对象
import * as MathUtils from './math.js';
console.log(MathUtils.add(1, 2));     // 3
console.log(MathUtils.subtract(5, 3)); // 2
console.log(MathUtils.PI);            // 3.14159265

// 使用
const logger = new Logger('App');
logger.log('应用启动');
logger.log(`1 + 2 = ${add(1, 2)}`);
```

ES Modules 有几个重要的特性是之前方案不具备的：

```javascript
// 1. 静态分析：import 必须在顶层，不能在条件语句或函数中
// 这使得构建工具可以在编译时分析依赖关系

// ❌ 不合法的写法
if (condition) {
  import { something } from './module.js'; // SyntaxError
}

// 2. 导出是实时绑定（live binding），不是值拷贝
// counter.js
export let count = 0;
export function increment() {
  count++;
}

// app.js
import { count, increment } from './counter.js';
console.log(count); // 0
increment();
// count 会实时反映模块内部的变化
console.log(count); // 1

// 3. 模块默认是严格模式，不需要手动写 'use strict'
// 4. 模块有自己的作用域，顶层的 this 是 undefined
```

## 动态 import()

ES Modules 的 `import` 是静态的，但实际场景中我们经常需要按条件加载模块。ES2020 提案引入了 `import()` 函数：

```javascript
// 场景一：路由懒加载
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
    // 只有登录用户才加载 Dashboard
    component: () => {
      if (isLoggedIn()) {
        return import('./pages/Dashboard.js');
      }
      return import('./pages/Login.js');
    }
  }
];

// 场景二：按需加载大型库
async function exportToExcel(data) {
  // 只在用户点击「导出」时才加载 xlsx 库
  const XLSX = await import('xlsx');

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, 'export.xlsx');
}

// 场景三：错误重试
async function loadModuleWithRetry(modulePath, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const module = await import(modulePath);
      return module;
    } catch (error) {
      console.warn(`加载失败，第 ${i + 1} 次重试...`, error);
      if (i === retries - 1) throw error;
    }
  }
}

// 场景四：条件导入不同的实现
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

`import()` 返回一个 Promise，解析值是模块的命名空间对象（包含所有命名导出和 `default`）。

## Webpack 中的模块打包

Webpack 是 2019 年最主流的模块打包工具。它支持所有上述模块规范，并将它们统一打包：

```javascript
// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    // 入口：从这里开始分析依赖
    main: './src/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
  },
  // 代码分割配置
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // 第三方库单独打包
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        // 公共模块提取
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
// src/index.js —— 项目入口
// Webpack 能识别所有模块格式，但推荐使用 ES Modules
import { add } from './utils/math';
import('./pages/Home').then(({ default: Home }) => {
  // 动态 import 会被 Webpack 自动分割为独立的 chunk
  const home = new Home();
  home.render();
});

console.log(add(1, 2));
```

```javascript
// src/utils/math.js
// Tree Shaking 的关键：使用 ES Modules 的命名导出
// Webpack 可以在构建时分析出哪些导出没有被使用，然后剔除它们

export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// 如果项目中没有使用 multiply，
// Webpack 的 tree shaking 会把它从最终产物中移除
export function multiply(a, b) {
  return a * b;
}

// ⚠️ 注意：CommonJS 的 module.exports 不支持 tree shaking
// 因为它是运行时的动态赋值，构建工具无法静态分析
```

```javascript
// tree shaking 示例
// index.js
import { add } from './math';
// multiply 没有被导入，webpack 会将它从产物中移除

// 最终产物中只包含 add 函数的代码
// subtract 和 multiply 都不会被打包进来
```

## 各模块方案对比

```
         作用域隔离   异步加载   静态分析   浏览器支持   Node支持   Tree Shaking
IIFE       ✅          ❌         ❌         ✅          ✅         ❌
CommonJS   ✅          ❌         ❌         ❌*         ✅         ❌
AMD        ✅          ✅         ❌         ✅          ❌         ❌
UMD        ✅          ✅         ❌         ✅          ✅         ❌
ESM        ✅          ✅         ✅         ✅**        ✅***      ✅

* CommonJS 在浏览器端需要 Browserify/Webpack 转换
** 现代浏览器原生支持 <script type="module">
*** Node.js 12+ 开始原生支持 ES Modules
```

```html
<!-- 浏览器原生使用 ES Modules -->
<script type="module" src="./app.js"></script>

<!-- 注意：type="module" 默认就是 defer 的 -->
<!-- 也可以内联 -->
<script type="module">
  import { add } from './math.js';
  console.log(add(1, 2));
</script>

<!-- 降级方案：用 nomodule 给不支持 ES Module 的旧浏览器提供打包版本 -->
<script nomodule src="./legacy-bundle.js"></script>
```

## 小结

- JavaScript 模块化经历了 IIFE → CommonJS → AMD → UMD → ES Modules 的演进，每次演进都是为了解决前一代方案的核心痛点
- IIFE 用函数作用域隔离变量，但依赖手动管理加载顺序；CommonJS 是 Node.js 的同步方案，不适合浏览器直接使用
- AMD 为浏览器设计了异步加载，但语法繁琐；UMD 兼容所有环境但代码冗余
- ES Modules 是语言原生标准，静态分析友好，支持 tree shaking 和动态 `import()`，是现代前端的首选方案
- 实际项目中通过 Webpack 等构建工具打包，利用动态 `import()` 实现代码分割，ES Modules 的静态特性让 tree shaking 成为可能
