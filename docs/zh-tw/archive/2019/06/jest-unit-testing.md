---
title: "Jest 前端單元測試實戰指南"
date: 2019-06-19 10:41:50
tags:
  - 測試
readingTime: 6
description: "前端專案越來越複雜，單元測試不再是後端的專屬。用 Jest 寫好測試，既能保證程式碼質量，又能放心重構。"
---

前端專案越來越複雜，單元測試不再是後端的專屬。用 Jest 寫好測試，既能保證程式碼質量，又能放心重構。

## 環境搭建

使用 Create React App 的專案已經內建了 Jest，其他專案需要手動安裝。

```bash
# 安裝 Jest
npm install --save-dev jest babel-jest @babel/core @babel/preset-env

# 如果測試 React 元件，還需要
npm install --save-dev @testing-library/react @testing-library/jest-dom react-test-renderer
```

配置 `package.json`：

```json
{
    "scripts": {
        "test": "jest",
        "test:watch": "jest --watch",
        "test:coverage": "jest --coverage"
    },
    "jest": {
        "testMatch": ["**/__tests__/**/*.js", "**/*.test.js"],
        "moduleNameMapper": {
            "\\.(css|less|scss)$": "identity-obj-proxy",
            "\\.(png|jpg|jpeg|gif|svg)$": "<rootDir>/__mocks__/fileMock.js"
        },
        "collectCoverageFrom": [
            "src/**/*.js",
            "!src/index.js"
        ]
    }
}
```

Babel 配置 `.babelrc`：

```json
{
    "presets": [
        ["@babel/preset-env", { "targets": { "node": "current" } }]
    ]
}
```

## 基本匹配器（Matchers）

Jest 提供了豐富的斷言方法，以下是最常用的幾個。

```javascript
// math.js - 被測試的工具函式
export function sum(a, b) {
    return a + b;
}

export function subtract(a, b) {
    return a - b;
}

export function multiply(a, b) {
    return a * b;
}

export function divide(a, b) {
    if (b === 0) {
        throw new Error('除數不能為零');
    }
    return a / b;
}
```

```javascript
// math.test.js
import { sum, subtract, multiply, divide } from './math';

describe('數學工具函式', () => {

    // toBe：嚴格相等（===）
    test('sum 正確計算兩數之和', () => {
        expect(sum(1, 2)).toBe(3);
        expect(sum(-1, 1)).toBe(0);
        expect(sum(0, 0)).toBe(0);
    });

    // toEqual：深度相等（適合物件和陣列）
    test('物件深度比較', () => {
        const config = { debug: true, port: 3000 };
        expect(config).toEqual({ debug: true, port: 3000 });

        const items = [1, 2, { name: 'test' }];
        expect(items).toEqual([1, 2, { name: 'test' }]);
    });

    // toBeTruthy / toBeFalsy
    test('布林值判斷', () => {
        expect(sum(1, 1)).toBeTruthy();
        expect(0).toBeFalsy();
        expect('').toBeFalsy();
        expect(null).toBeFalsy();
    });

    // toBeGreaterThan / toBeLessThan
    test('數值比較', () => {
        expect(multiply(3, 4)).toBeGreaterThan(10);
        expect(multiply(2, 3)).toBeLessThanOrEqual(6);
    });

    // toMatch：正則匹配（適合字串）
    test('字串匹配', () => {
        const greeting = 'Hello, Jest!';
        expect(greeting).toMatch(/Jest/);
        expect(greeting).toMatch(/^Hello/);
        expect('2019-06-19').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    // toContain：陣列或字串包含
    test('包含檢測', () => {
        expect([1, 2, 3]).toContain(2);
        expect(['vue', 'react', 'angular']).toContain('react');
        expect('hello world').toContain('world');
    });

    // toThrow：檢測異常
    test('異常檢測', () => {
        expect(() => divide(1, 0)).toThrow('除數不能為零');
        expect(() => divide(1, 0)).toThrow(Error);
    });

    // not：取反
    test('取反斷言', () => {
        expect(sum(1, 2)).not.toBe(4);
        expect(null).not.toBeTruthy();
    });
});
```

執行結果：

```bash
$ npm test
 PASS  src/math.test.js
  數學工具函式
    ✓ sum 正確計算兩數之和 (3ms)
    ✓ 物件深度比較 (1ms)
    ✓ 布林值判斷
    ✓ 數值比較
    ✓ 字串匹配
    ✓ 包含檢測
    ✓ 異常檢測
    ✓ 取反斷言

Tests:       8 passed, 8 total
```

## 測試非同步程式碼

前端大量程式碼是非同步的，Jest 提供了幾種處理非同步的方式。

```javascript
// api.js - 非同步請求模組
export function fetchUser(id) {
    return fetch(`/api/users/${id}`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`請求失敗: ${res.status}`);
            }
            return res.json();
        });
}

export async function fetchUserAsync(id) {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) {
        throw new Error(`請求失敗: ${res.status}`);
    }
    return res.json();
}
```

```javascript
// api.test.js
import { fetchUser, fetchUserAsync } from './api';

describe('非同步請求測試', () => {

    // 方式1：return Promise
    test('fetchUser 返回使用者資料（Promise 方式）', () => {
        // 需要 return，讓 Jest 等待 Promise 完成
        return fetchUser(1).then(user => {
            expect(user).toBeDefined();
        });
    });

    // 方式2：async/await（推薦，更清晰）
    test('fetchUserAsync 返回使用者資料（async/await 方式）', async () => {
        const user = await fetchUserAsync(1);
        expect(user).toBeDefined();
    });

    // 方式3：測試 reject
    test('fetchUser 請求失敗時丟擲錯誤', async () => {
        await expect(fetchUser(999)).rejects.toThrow('請求失敗');
    });

    // 方式4：resolves 匹配器
    test('使用 resolves 匹配器', async () => {
        await expect(fetchUser(1)).resolves.toBeDefined();
    });
});
```

## Mock 函式

Mock 是單元測試的核心，Jest 提供了非常強大的 mock 能力。

### jest.fn() 建立 mock 函式

```javascript
// event.js - 事件處理模組
export function bindClick(element, callback) {
    element.addEventListener('click', callback);
}

export function processArray(arr, callback) {
    return arr.map(item => callback(item));
}
```

```javascript
// event.test.js
import { processArray } from './event';

describe('Mock 函式', () => {

    test('jest.fn() 基本用法', () => {
        // 建立一個 mock 函式
        const mockCallback = jest.fn();

        // 設定返回值
        mockCallback.mockReturnValue(42);
        expect(mockCallback()).toBe(42);

        // 設定每次呼叫的返回值
        mockCallback
            .mockReturnValueOnce('第一次')
            .mockReturnValueOnce('第二次');

        expect(mockCallback()).toBe('第一次');
        expect(mockCallback()).toBe('第二次');
    });

    test('追蹤函式呼叫', () => {
        const mockFn = jest.fn();

        mockFn('hello', 1);
        mockFn('world', 2);
        mockFn('jest', 3);

        // 呼叫次數
        expect(mockFn).toHaveBeenCalledTimes(3);

        // 檢查某一次呼叫的引數
        expect(mockFn).toHaveBeenCalledWith('hello', 1);
        expect(mockFn).toHaveBeenNthCalledWith(2, 'world', 2);
        expect(mockFn).toHaveBeenLastCalledWith('jest', 3);

        // 獲取所有呼叫的引數
        expect(mockFn.mock.calls).toEqual([
            ['hello', 1],
            ['world', 2],
            ['jest', 3],
        ]);
    });

    test('mock 實現', () => {
        // mockImplementation 可以自定義實現
        const mockFn = jest.fn((x) => x * 2);
        expect(mockFn(5)).toBe(10);

        // 配合 processArray 使用
        const double = jest.fn(x => x * 2);
        const result = processArray([1, 2, 3], double);

        expect(result).toEqual([2, 4, 6]);
        expect(double).toHaveBeenCalledTimes(3);
    });

    test('非同步 mock', async () => {
        const mockAsync = jest.fn();

        // 模擬成功的 Promise
        mockAsync.mockResolvedValue({ id: 1, name: '張三' });
        await expect(mockAsync()).resolves.toEqual({ id: 1, name: '張三' });

        // 模擬失敗的 Promise
        mockAsync.mockRejectedValue(new Error('網路錯誤'));
        await expect(mockAsync()).rejects.toThrow('網路錯誤');
    });
});
```

### jest.mock() 模擬模組

```javascript
// storage.js
export function saveToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function getFromStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}
```

```javascript
// storage.test.js
import { saveToStorage, getFromStorage } from './storage';

// 模擬整個 localStorage
beforeEach(() => {
    // 建立一個記憶體中的 store 物件
    let store = {};

    Object.defineProperty(global, 'localStorage', {
        value: {
            getItem: jest.fn(key => store[key] || null),
            setItem: jest.fn((key, value) => {
                store[key] = value;
            }),
            removeItem: jest.fn(key => {
                delete store[key];
            }),
            clear: jest.fn(() => {
                store = {};
            }),
        },
        writable: true,
    });
});

describe('localStorage 操作', () => {

    test('儲存和讀取資料', () => {
        const user = { id: 1, name: '張三' };
        saveToStorage('user', user);

        expect(localStorage.setItem).toHaveBeenCalledWith(
            'user',
            JSON.stringify(user)
        );

        const result = getFromStorage('user');
        expect(result).toEqual(user);
    });

    test('讀取不存在的 key 返回 null', () => {
        const result = getFromStorage('nonexistent');
        expect(result).toBeNull();
    });
});
```

## 測試 React 元件

使用 `@testing-library/react` 來測試 React 元件，這是目前推薦的方式。

```jsx
// Counter.js - 一個簡單的計數器元件
import React, { useState } from 'react';

function Counter({ initialCount = 0, step = 1, onCountChange }) {
    const [count, setCount] = useState(initialCount);

    const handleIncrement = () => {
        const newCount = count + step;
        setCount(newCount);
        onCountChange && onCountChange(newCount);
    };

    const handleDecrement = () => {
        const newCount = count - step;
        setCount(newCount);
        onCountChange && onCountChange(newCount);
    };

    const handleReset = () => {
        setCount(initialCount);
        onCountChange && onCountChange(initialCount);
    };

    return (
        <div className="counter">
            <h2>計數器</h2>
            <span data-testid="count">{count}</span>
            <button onClick={handleDecrement}>減少</button>
            <button onClick={handleIncrement}>增加</button>
            <button onClick={handleReset}>重置</button>
        </div>
    );
}

export default Counter;
```

```jsx
// Counter.test.js
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Counter from './Counter';

describe('Counter 元件', () => {

    test('正確渲染初始值', () => {
        render(<Counter initialCount={5} />);
        const countEl = screen.getByTestId('count');
        expect(countEl).toHaveTextContent('5');
    });

    test('預設初始值為 0', () => {
        render(<Counter />);
        expect(screen.getByTestId('count')).toHaveTextContent('0');
    });

    test('點選增加按鈕，計數+1', () => {
        render(<Counter />);
        fireEvent.click(screen.getByText('增加'));
        expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    test('點選減少按鈕，計數-1', () => {
        render(<Counter initialCount={5} />);
        fireEvent.click(screen.getByText('減少'));
        expect(screen.getByTestId('count')).toHaveTextContent('4');
    });

    test('自定義步長', () => {
        render(<Counter initialCount={0} step={5} />);
        fireEvent.click(screen.getByText('增加'));
        fireEvent.click(screen.getByText('增加'));
        expect(screen.getByTestId('count')).toHaveTextContent('10');
    });

    test('重置按鈕恢復初始值', () => {
        render(<Counter initialCount={10} />);
        fireEvent.click(screen.getByText('增加'));
        fireEvent.click(screen.getByText('增加'));
        fireEvent.click(screen.getByText('重置'));
        expect(screen.getByTestId('count')).toHaveTextContent('10');
    });

    test('計數變化時呼叫回撥', () => {
        const handleChange = jest.fn();
        render(<Counter onCountChange={handleChange} />);

        fireEvent.click(screen.getByText('增加'));
        expect(handleChange).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByText('增加'));
        expect(handleChange).toHaveBeenCalledWith(2);

        expect(handleChange).toHaveBeenCalledTimes(2);
    });
});
```

## 快照測試

快照測試適合驗證元件渲染結果不會意外改變。

```jsx
// Button.js
import React from 'react';

function Button({ type = 'default', size = 'medium', children, onClick, disabled }) {
    const classNames = `btn btn-${type} btn-${size}`;
    return (
        <button
            className={classNames}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

export default Button;
```

```jsx
// Button.test.js
import React from 'react';
import renderer from 'react-test-renderer';
import Button from './Button';

describe('Button 快照測試', () => {

    test('預設按鈕快照', () => {
        const tree = renderer.create(
            <Button>點選我</Button>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });

    test('主要按鈕快照', () => {
        const tree = renderer.create(
            <Button type="primary" size="large">提交</Button>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });

    test('停用按鈕快照', () => {
        const tree = renderer.create(
            <Button disabled>不可用</Button>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
```

首次執行會生成 `__snapshots__/Button.test.js.snap` 檔案，後續執行會對比快照。如果元件渲染結果變化了，需要更新快照：

```bash
# 更新快照
$ jest --updateSnapshot

# 或者互動式更新
$ jest --watch
# 按 u 更新選中的快照
```

## 程式碼覆蓋率

Jest 內建了覆蓋率報告，使用 Istanbul 收集。

```bash
# 執行測試並生成覆蓋率報告
$ npm run test:coverage
```

`package.json` 中配置覆蓋率收集範圍：

```json
{
    "jest": {
        "collectCoverageFrom": [
            "src/**/*.js",
            "src/**/*.jsx",
            "!src/index.js",
            "!src/**/*.test.js",
            "!src/**/__mocks__/**"
        ],
        "coverageThresholds": {
            "global": {
                "branches": 80,
                "functions": 80,
                "lines": 80,
                "statements": 80
            }
        }
    }
}
```

覆蓋率報告解讀：

```
-
-------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   92.31 |    85.71 |     100 |   92.31 |
 utils              |     100 |      100 |     100 |     100 |
  format.js         |     100 |      100 |     100 |     100 |
 components         |   88.89 |    77.78 |     100 |   88.89 |
  Counter.js        |   88.89 |    77.78 |     100 |   88.89 |
--------------------|---------|----------|---------|---------|

# 四個指標含義：
# % Stmts   — 語句覆蓋率：有多少語句被執行了
# % Branch  — 分支覆蓋率：if/else 等分支是否都被覆蓋
# % Funcs   — 函式覆蓋率：有多少函式被呼叫了
# % Lines   — 行覆蓋率：有多少行程式碼被執行了
```

## 實用技巧

### beforeEach / afterEach

```javascript
describe('使用者模組', () => {
    let testData;

    beforeEach(() => {
        // 每個測試用例之前執行，保證測試獨立
        testData = {
            users: [
                { id: 1, name: '張三' },
                { id: 2, name: '李四' },
            ],
        };
    });

    afterEach(() => {
        // 清理工作
        testData = null;
    });

    test('查詢使用者', () => {
        const user = testData.users.find(u => u.id === 1);
        expect(user.name).toBe('張三');
    });

    test('使用者數量', () => {
        expect(testData.users).toHaveLength(2);
    });
});
```

### 測試定時器

```javascript
// poll.js
export function startPolling(callback, interval) {
    return setInterval(callback, interval);
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

```javascript
// poll.test.js
import { delay } from './poll';

describe('定時器測試', () => {

    // 使用 fake timers
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('setTimeout 在指定時間後執行', () => {
        const callback = jest.fn();
        setTimeout(callback, 1000);

        expect(callback).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('delay Promise 解析', async () => {
        const mockFn = jest.fn();
        const promise = delay(2000).then(mockFn);

        jest.advanceTimersByTime(2000);

        await promise;
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
});
```

## 小結

- **先寫核心邏輯的單元測試**，覆蓋正常流程和異常情況，`toBe` / `toEqual` / `toThrow` 是最常用的匹配器
- **非同步測試用 async/await**，配合 `resolves` / `rejects` 更簡潔
- **jest.fn() 和 jest.mock()** 是 mock 的兩大利器，前者模擬函式，後者模擬整個模組
- **React 元件測試用 @testing-library/react**，優先通過使用者行為（點選、輸入）來測試，而不是測試實現細節
- **快照測試適合穩定的 UI 元件**，不適合頻繁變動的元件
- **程式碼覆蓋率是參考指標**，不是目標，100% 覆蓋率不等於沒有 bug
