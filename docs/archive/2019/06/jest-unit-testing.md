---
title: "Jest 前端单元测试实战指南"
date: 2019-06-19 10:41:50
tags:
  - 测试
readingTime: 6
description: "前端项目越来越复杂，单元测试不再是后端的专属。用 Jest 写好测试，既能保证代码质量，又能放心重构。"
wordCount: 469
---

前端项目越来越复杂，单元测试不再是后端的专属。用 Jest 写好测试，既能保证代码质量，又能放心重构。

## 环境搭建

使用 Create React App 的项目已经内置了 Jest，其他项目需要手动安装。

```bash
# 安装 Jest
npm install --save-dev jest babel-jest @babel/core @babel/preset-env

# 如果测试 React 组件，还需要
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

Jest 提供了丰富的断言方法，以下是最常用的几个。

```javascript
// math.js - 被测试的工具函数
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
        throw new Error('除数不能为零');
    }
    return a / b;
}
```

```javascript
// math.test.js
import { sum, subtract, multiply, divide } from './math';

describe('数学工具函数', () => {

    // toBe：严格相等（===）
    test('sum 正确计算两数之和', () => {
        expect(sum(1, 2)).toBe(3);
        expect(sum(-1, 1)).toBe(0);
        expect(sum(0, 0)).toBe(0);
    });

    // toEqual：深度相等（适合对象和数组）
    test('对象深度比较', () => {
        const config = { debug: true, port: 3000 };
        expect(config).toEqual({ debug: true, port: 3000 });

        const items = [1, 2, { name: 'test' }];
        expect(items).toEqual([1, 2, { name: 'test' }]);
    });

    // toBeTruthy / toBeFalsy
    test('布尔值判断', () => {
        expect(sum(1, 1)).toBeTruthy();
        expect(0).toBeFalsy();
        expect('').toBeFalsy();
        expect(null).toBeFalsy();
    });

    // toBeGreaterThan / toBeLessThan
    test('数值比较', () => {
        expect(multiply(3, 4)).toBeGreaterThan(10);
        expect(multiply(2, 3)).toBeLessThanOrEqual(6);
    });

    // toMatch：正则匹配（适合字符串）
    test('字符串匹配', () => {
        const greeting = 'Hello, Jest!';
        expect(greeting).toMatch(/Jest/);
        expect(greeting).toMatch(/^Hello/);
        expect('2019-06-19').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    // toContain：数组或字符串包含
    test('包含检测', () => {
        expect([1, 2, 3]).toContain(2);
        expect(['vue', 'react', 'angular']).toContain('react');
        expect('hello world').toContain('world');
    });

    // toThrow：检测异常
    test('异常检测', () => {
        expect(() => divide(1, 0)).toThrow('除数不能为零');
        expect(() => divide(1, 0)).toThrow(Error);
    });

    // not：取反
    test('取反断言', () => {
        expect(sum(1, 2)).not.toBe(4);
        expect(null).not.toBeTruthy();
    });
});
```

运行结果：

```bash
$ npm test
 PASS  src/math.test.js
  数学工具函数
    ✓ sum 正确计算两数之和 (3ms)
    ✓ 对象深度比较 (1ms)
    ✓ 布尔值判断
    ✓ 数值比较
    ✓ 字符串匹配
    ✓ 包含检测
    ✓ 异常检测
    ✓ 取反断言

Tests:       8 passed, 8 total
```

## 测试异步代码

前端大量代码是异步的，Jest 提供了几种处理异步的方式。

```javascript
// api.js - 异步请求模块
export function fetchUser(id) {
    return fetch(`/api/users/${id}`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`请求失败: ${res.status}`);
            }
            return res.json();
        });
}

export async function fetchUserAsync(id) {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) {
        throw new Error(`请求失败: ${res.status}`);
    }
    return res.json();
}
```

```javascript
// api.test.js
import { fetchUser, fetchUserAsync } from './api';

describe('异步请求测试', () => {

    // 方式1：return Promise
    test('fetchUser 返回用户数据（Promise 方式）', () => {
        // 需要 return，让 Jest 等待 Promise 完成
        return fetchUser(1).then(user => {
            expect(user).toBeDefined();
        });
    });

    // 方式2：async/await（推荐，更清晰）
    test('fetchUserAsync 返回用户数据（async/await 方式）', async () => {
        const user = await fetchUserAsync(1);
        expect(user).toBeDefined();
    });

    // 方式3：测试 reject
    test('fetchUser 请求失败时抛出错误', async () => {
        await expect(fetchUser(999)).rejects.toThrow('请求失败');
    });

    // 方式4：resolves 匹配器
    test('使用 resolves 匹配器', async () => {
        await expect(fetchUser(1)).resolves.toBeDefined();
    });
});
```

## Mock 函数

Mock 是单元测试的核心，Jest 提供了非常强大的 mock 能力。

### jest.fn() 创建 mock 函数

```javascript
// event.js - 事件处理模块
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

describe('Mock 函数', () => {

    test('jest.fn() 基本用法', () => {
        // 创建一个 mock 函数
        const mockCallback = jest.fn();

        // 设置返回值
        mockCallback.mockReturnValue(42);
        expect(mockCallback()).toBe(42);

        // 设置每次调用的返回值
        mockCallback
            .mockReturnValueOnce('第一次')
            .mockReturnValueOnce('第二次');

        expect(mockCallback()).toBe('第一次');
        expect(mockCallback()).toBe('第二次');
    });

    test('追踪函数调用', () => {
        const mockFn = jest.fn();

        mockFn('hello', 1);
        mockFn('world', 2);
        mockFn('jest', 3);

        // 调用次数
        expect(mockFn).toHaveBeenCalledTimes(3);

        // 检查某一次调用的参数
        expect(mockFn).toHaveBeenCalledWith('hello', 1);
        expect(mockFn).toHaveBeenNthCalledWith(2, 'world', 2);
        expect(mockFn).toHaveBeenLastCalledWith('jest', 3);

        // 获取所有调用的参数
        expect(mockFn.mock.calls).toEqual([
            ['hello', 1],
            ['world', 2],
            ['jest', 3],
        ]);
    });

    test('mock 实现', () => {
        // mockImplementation 可以自定义实现
        const mockFn = jest.fn((x) => x * 2);
        expect(mockFn(5)).toBe(10);

        // 配合 processArray 使用
        const double = jest.fn(x => x * 2);
        const result = processArray([1, 2, 3], double);

        expect(result).toEqual([2, 4, 6]);
        expect(double).toHaveBeenCalledTimes(3);
    });

    test('异步 mock', async () => {
        const mockAsync = jest.fn();

        // 模拟成功的 Promise
        mockAsync.mockResolvedValue({ id: 1, name: '张三' });
        await expect(mockAsync()).resolves.toEqual({ id: 1, name: '张三' });

        // 模拟失败的 Promise
        mockAsync.mockRejectedValue(new Error('网络错误'));
        await expect(mockAsync()).rejects.toThrow('网络错误');
    });
});
```

### jest.mock() 模拟模块

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

// 模拟整个 localStorage
beforeEach(() => {
    // 创建一个内存中的 store 对象
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

    test('保存和读取数据', () => {
        const user = { id: 1, name: '张三' };
        saveToStorage('user', user);

        expect(localStorage.setItem).toHaveBeenCalledWith(
            'user',
            JSON.stringify(user)
        );

        const result = getFromStorage('user');
        expect(result).toEqual(user);
    });

    test('读取不存在的 key 返回 null', () => {
        const result = getFromStorage('nonexistent');
        expect(result).toBeNull();
    });
});
```

## 测试 React 组件

使用 `@testing-library/react` 来测试 React 组件，这是目前推荐的方式。

```jsx
// Counter.js - 一个简单的计数器组件
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
            <h2>计数器</h2>
            <span data-testid="count">{count}</span>
            <button onClick={handleDecrement}>减少</button>
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

describe('Counter 组件', () => {

    test('正确渲染初始值', () => {
        render(<Counter initialCount={5} />);
        const countEl = screen.getByTestId('count');
        expect(countEl).toHaveTextContent('5');
    });

    test('默认初始值为 0', () => {
        render(<Counter />);
        expect(screen.getByTestId('count')).toHaveTextContent('0');
    });

    test('点击增加按钮，计数+1', () => {
        render(<Counter />);
        fireEvent.click(screen.getByText('增加'));
        expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    test('点击减少按钮，计数-1', () => {
        render(<Counter initialCount={5} />);
        fireEvent.click(screen.getByText('减少'));
        expect(screen.getByTestId('count')).toHaveTextContent('4');
    });

    test('自定义步长', () => {
        render(<Counter initialCount={0} step={5} />);
        fireEvent.click(screen.getByText('增加'));
        fireEvent.click(screen.getByText('增加'));
        expect(screen.getByTestId('count')).toHaveTextContent('10');
    });

    test('重置按钮恢复初始值', () => {
        render(<Counter initialCount={10} />);
        fireEvent.click(screen.getByText('增加'));
        fireEvent.click(screen.getByText('增加'));
        fireEvent.click(screen.getByText('重置'));
        expect(screen.getByTestId('count')).toHaveTextContent('10');
    });

    test('计数变化时调用回调', () => {
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

## 快照测试

快照测试适合验证组件渲染结果不会意外改变。

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

describe('Button 快照测试', () => {

    test('默认按钮快照', () => {
        const tree = renderer.create(
            <Button>点击我</Button>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });

    test('主要按钮快照', () => {
        const tree = renderer.create(
            <Button type="primary" size="large">提交</Button>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });

    test('禁用按钮快照', () => {
        const tree = renderer.create(
            <Button disabled>不可用</Button>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
```

首次运行会生成 `__snapshots__/Button.test.js.snap` 文件，后续运行会对比快照。如果组件渲染结果变化了，需要更新快照：

```bash
# 更新快照
$ jest --updateSnapshot

# 或者交互式更新
$ jest --watch
# 按 u 更新选中的快照
```

## 代码覆盖率

Jest 内置了覆盖率报告，使用 Istanbul 收集。

```bash
# 运行测试并生成覆盖率报告
$ npm run test:coverage
```

`package.json` 中配置覆盖率收集范围：

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

覆盖率报告解读：

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

# 四个指标含义：
# % Stmts   — 语句覆盖率：有多少语句被执行了
# % Branch  — 分支覆盖率：if/else 等分支是否都被覆盖
# % Funcs   — 函数覆盖率：有多少函数被调用了
# % Lines   — 行覆盖率：有多少行代码被执行了
```

## 实用技巧

### beforeEach / afterEach

```javascript
describe('用户模块', () => {
    let testData;

    beforeEach(() => {
        // 每个测试用例之前执行，保证测试独立
        testData = {
            users: [
                { id: 1, name: '张三' },
                { id: 2, name: '李四' },
            ],
        };
    });

    afterEach(() => {
        // 清理工作
        testData = null;
    });

    test('查找用户', () => {
        const user = testData.users.find(u => u.id === 1);
        expect(user.name).toBe('张三');
    });

    test('用户数量', () => {
        expect(testData.users).toHaveLength(2);
    });
});
```

### 测试定时器

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

describe('定时器测试', () => {

    // 使用 fake timers
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('setTimeout 在指定时间后执行', () => {
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

## 小结

- **先写核心逻辑的单元测试**，覆盖正常流程和异常情况，`toBe` / `toEqual` / `toThrow` 是最常用的匹配器
- **异步测试用 async/await**，配合 `resolves` / `rejects` 更简洁
- **jest.fn() 和 jest.mock()** 是 mock 的两大利器，前者模拟函数，后者模拟整个模块
- **React 组件测试用 @testing-library/react**，优先通过用户行为（点击、输入）来测试，而不是测试实现细节
- **快照测试适合稳定的 UI 组件**，不适合频繁变动的组件
- **代码覆盖率是参考指标**，不是目标，100% 覆盖率不等于没有 bug
