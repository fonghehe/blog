---
title: "Jest Mock: Complete Guide to Mocking Modules and Functions"
date: 2019-09-18 16:13:14
tags:
  - Engineering
readingTime: 4
description: "单元测试中经常需要隔离被测代码的依赖：替换 API 调用、模拟定时器、mock 第三方库。Jest 提供了一套完整的 mock 工具链，从简单的函数 mock 到模块级别的替换，覆盖了绝大多数测试场景。本文将系统讲解 Jest 中各种 mock 的用法和最佳实践。"
wordCount: 320
---

单元测试中经常需要隔离被测代码的依赖：替换 API 调用、模拟定时器、mock 第三方库。Jest 提供了一套完整的 mock 工具链，从简单的函数 mock 到模块级别的替换，覆盖了绝大多数测试场景。本文将系统讲解 Jest 中各种 mock 的用法和最佳实践。

## Mock 函数基础

### jest.fn() 创建 mock 函数

```js
// 创建一个 mock 函数
const mockFn = jest.fn();

// 调用
mockFn();
mockFn('hello', 'world');
mockFn(42);

// 断言
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(3);
expect(mockFn).toHaveBeenCalledWith('hello', 'world');
expect(mockFn).toHaveBeenLastCalledWith(42);
```

### 设置返回值

```js
const mockFn = jest.fn();

// 固定返回值
mockFn.mockReturnValue(42);
expect(mockFn()).toBe(42);

// 每次调用返回不同值
mockFn
  .mockReturnValueOnce('first')
  .mockReturnValueOnce('second')
  .mockReturnValue('default');

expect(mockFn()).toBe('first');
expect(mockFn()).toBe('second');
expect(mockFn()).toBe('default');
expect(mockFn()).toBe('default');

// 异步返回值
const asyncMock = jest.fn();
asyncMock.mockResolvedValue({ data: 'success' });
// 或 mockResolvedValueOnce

const result = await asyncMock();
expect(result).toEqual({ data: 'success' });

// 异步拒绝
asyncMock.mockRejectedValue(new Error('网络错误'));
await expect(asyncMock()).rejects.toThrow('网络错误');
```

### 设置实现

```js
const mockFn = jest.fn();

// 自定义实现
mockFn.mockImplementation((a, b) => a + b);
expect(mockFn(1, 2)).toBe(3);

// 每次调用不同的实现
mockFn
  .mockImplementationOnce(() => 'first')
  .mockImplementationOnce(() => 'second');

expect(mockFn()).toBe('first');
expect(mockFn()).toBe('second');

// 异步实现
const asyncMock = jest.fn();
asyncMock.mockImplementation(async () => {
  const result = await someAsyncOperation();
  return result;
});
```

## Mock 整个模块

### Mock 第三方库

```js
// __mocks__/axios.js（放在与 node_modules 同级的 __mocks__ 目录）
export default {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  create: jest.fn(function () {
    return this;
  }),
};
```

在测试文件中：

```js
import axios from 'axios';
import { fetchUsers } from './userService';

// 自动使用 __mocks__/axios.js
jest.mock('axios');

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // 每次测试前清除 mock 状态
  });

  it('应该正确获取用户列表', async () => {
    const mockUsers = [
      { id: 1, name: '张三' },
      { id: 2, name: '李四' },
    ];

    axios.get.mockResolvedValue({ data: mockUsers });

    const users = await fetchUsers();

    expect(axios.get).toHaveBeenCalledWith('/api/users');
    expect(users).toEqual(mockUsers);
  });

  it('应该处理请求失败', async () => {
    axios.get.mockRejectedValue(new Error('网络错误'));

    await expect(fetchUsers()).rejects.toThrow('网络错误');
  });
});
```

### Mock 项目内的模块

```js
// src/services/userService.js
import api from './api';

export function getUser(id) {
  return api.get(`/users/${id}`);
}

export function createUser(data) {
  return api.post('/users', data);
}
```

```js
// src/services/__tests__/userService.test.js
import { getUser, createUser } from '../userService';

// Mock 整个 api 模块
jest.mock('../api', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

import api from '../api';

describe('userService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('应该调用正确的 URL', async () => {
      const mockUser = { id: 1, name: '张三' };
      api.get.mockResolvedValue({ data: mockUser });

      const result = await getUser(1);

      expect(api.get).toHaveBeenCalledWith('/users/1');
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('createUser', () => {
    it('应该发送正确的数据', async () => {
      const newUser = { name: '王五', email: 'wangwu@example.com' };
      api.post.mockResolvedValue({ data: { id: 3, ...newUser } });

      const result = await createUser(newUser);

      expect(api.post).toHaveBeenCalledWith('/users', newUser);
      expect(result.data.id).toBe(3);
    });
  });
});
```

## Mock 日期和定时器

### Mock Date

```js
// 固定时间
const mockDate = new Date('2019-09-18T10:00:00Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

// 或使用 jest.setSystemTime（Jest 26+）
// jest.useFakeTimers('modern');
// jest.setSystemTime(new Date('2019-09-18'));

// 测试中
it('应该显示正确的创建时间', () => {
  jest.spyOn(global, 'Date').mockImplementation(() => new Date('2019-09-18'));

  const component = render(<PostCard post={mockPost} />);
  expect(component.getByText('2019-09-18')).toBeInTheDocument();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

### Mock 定时器

```js
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('应该在 3 秒后显示提示', () => {
  render(<AutoHideToast message="成功" duration={3000} />);

  expect(screen.getByText('成功')).toBeInTheDocument();

  // 快进 3 秒
  jest.advanceTimersByTime(3000);

  expect(screen.queryByText('成功')).not.toBeInTheDocument();
});

it('setInterval 应该每秒触发', () => {
  const callback = jest.fn();

  setInterval(callback, 1000);

  jest.advanceTimersByTime(5000);

  expect(callback).toHaveBeenCalledTimes(5);
});
```

## Mock localStorage

```js
// 创建 localStorage mock
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// 测试
it('应该保存 token 到 localStorage', () => {
  saveToken('abc123');
  expect(localStorage.setItem).toHaveBeenCalledWith('token', 'abc123');
});

it('应该从 localStorage 读取 token', () => {
  localStorage.getItem.mockReturnValue('abc123');
  expect(getToken()).toBe('abc123');
});
```

## Mock 项目中的工具函数

```js
// src/utils/logger.js
export function logError(error) {
  console.error('[ERROR]', error);
  // 上报到监控平台
}

export function logInfo(message) {
  console.log('[INFO]', message);
}
```

```js
// 测试文件中
import { processData } from '../dataProcessor';

// 部分 mock：只 mock logger，保留其他模块的真实实现
jest.mock('../utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

import { logError, logInfo } from '../utils/logger';

describe('dataProcessor', () => {
  it('处理失败时应该记录错误', () => {
    processData(null);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('数据为空')
    );
  });

  it('处理成功时应该记录信息', () => {
    processData({ id: 1 });
    expect(logInfo).toHaveBeenCalledWith(
      expect.stringContaining('处理完成')
    );
  });
});
```

## Mock Class

```js
// src/services/ApiService.js
export class ApiService {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async fetch(url) {
    const response = await fetch(this.baseURL + url);
    return response.json();
  }
}
```

```js
// 测试中 mock 整个类
jest.mock('../services/ApiService', () => {
  return {
    ApiService: jest.fn().mockImplementation(() => ({
      fetch: jest.fn(),
    })),
  };
});

import { ApiService } from '../services/ApiService';

it('应该使用 ApiService 获取数据', async () => {
  const mockInstance = new ApiService();
  mockInstance.fetch.mockResolvedValue({ id: 1, name: 'test' });

  // 被测代码会创建 ApiService 实例并调用 fetch
  const result = await someFunctionThatUsesApi();

  expect(ApiService).toHaveBeenCalledWith('https://api.example.com');
  expect(mockInstance.fetch).toHaveBeenCalledWith('/data');
});
```

## jest.spyOn 追踪真实函数调用

```js
import { formatDate } from '../utils/date';

it('应该格式化日期', () => {
  const spy = jest.spyOn(console, 'log');

  someFunction('2019-09-18');

  expect(spy).toHaveBeenCalledWith('格式化后的日期:', '2019年09月18日');

  spy.mockRestore(); // 恢复原始实现
});

// spyOn 也可以替换实现
const mathSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
expect(Math.random()).toBe(0.5);
mathSpy.mockRestore();
```

## Mock 清理策略

```js
// jest.config.js
module.exports = {
  // 每个测试文件运行前自动清除 mock
  clearMocks: true,
  // 自动恢复 mock（对 spyOn 有效）
  restoreMocks: true,
};

// 或手动清理
beforeEach(() => {
  jest.clearAllMocks();  // 清除调用记录、返回值等
  jest.restoreAllMocks(); // 恢复 spyOn 的原始实现
  jest.resetModules();    // 重置模块缓存
});
```

## Summary

- `jest.fn()` 创建 mock 函数，支持设置返回值（`mockReturnValue`）、实现（`mockImplementation`）和异步行为（`mockResolvedValue`/`mockRejectedValue`）
- `jest.mock()` 可以 mock 整个模块，支持使用 `__mocks__` 目录定义手动 mock
- `jest.spyOn()` 追踪真实函数的调用，也可以替换实现
- 定时器使用 `jest.useFakeTimers()` + `jest.advanceTimersByTime()` 控制时间
- localStorage、fetch 等浏览器 API 需要在 setup 文件中全局 mock
- 始终在测试结束后清理 mock 状态，避免测试间相互影响
- 部分 mock 可以只替换模块中的某些导出，保留其他导出的真实实现
