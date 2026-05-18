---
title: "Jest Mock 模組與函式完整指南"
date: 2019-09-18 16:13:14
tags:
  - 工程化
readingTime: 4
description: "單元測試中經常需要隔離被測程式碼的依賴：替換 API 呼叫、模擬定時器、mock 第三方庫。Jest 提供了一套完整的 mock 工具鏈，從簡單的函式 mock 到模組級別的替換，覆蓋了絕大多數測試場景。本文將系統講解 Jest 中各種 mock 的用法和最佳實踐。"
---

單元測試中經常需要隔離被測程式碼的依賴：替換 API 呼叫、模擬定時器、mock 第三方庫。Jest 提供了一套完整的 mock 工具鏈，從簡單的函式 mock 到模組級別的替換，覆蓋了絕大多數測試場景。本文將系統講解 Jest 中各種 mock 的用法和最佳實踐。

## Mock 函式基礎

### jest.fn() 建立 mock 函式

```js
// 建立一個 mock 函式
const mockFn = jest.fn();

// 呼叫
mockFn();
mockFn('hello', 'world');
mockFn(42);

// 斷言
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(3);
expect(mockFn).toHaveBeenCalledWith('hello', 'world');
expect(mockFn).toHaveBeenLastCalledWith(42);
```

### 設定返回值

```js
const mockFn = jest.fn();

// 固定返回值
mockFn.mockReturnValue(42);
expect(mockFn()).toBe(42);

// 每次呼叫返回不同值
mockFn
  .mockReturnValueOnce('first')
  .mockReturnValueOnce('second')
  .mockReturnValue('default');

expect(mockFn()).toBe('first');
expect(mockFn()).toBe('second');
expect(mockFn()).toBe('default');
expect(mockFn()).toBe('default');

// 非同步返回值
const asyncMock = jest.fn();
asyncMock.mockResolvedValue({ data: 'success' });
// 或 mockResolvedValueOnce

const result = await asyncMock();
expect(result).toEqual({ data: 'success' });

// 非同步拒絕
asyncMock.mockRejectedValue(new Error('網路錯誤'));
await expect(asyncMock()).rejects.toThrow('網路錯誤');
```

### 設定實現

```js
const mockFn = jest.fn();

// 自定義實現
mockFn.mockImplementation((a, b) => a + b);
expect(mockFn(1, 2)).toBe(3);

// 每次呼叫不同的實現
mockFn
  .mockImplementationOnce(() => 'first')
  .mockImplementationOnce(() => 'second');

expect(mockFn()).toBe('first');
expect(mockFn()).toBe('second');

// 非同步實現
const asyncMock = jest.fn();
asyncMock.mockImplementation(async () => {
  const result = await someAsyncOperation();
  return result;
});
```

## Mock 整個模組

### Mock 第三方庫

```js
// __mocks__/axios.js（放在與 node_modules 同級的 __mocks__ 目錄）
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

在測試檔案中：

```js
import axios from 'axios';
import { fetchUsers } from './userService';

// 自動使用 __mocks__/axios.js
jest.mock('axios');

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // 每次測試前清除 mock 狀態
  });

  it('應該正確獲取使用者列表', async () => {
    const mockUsers = [
      { id: 1, name: '張三' },
      { id: 2, name: '李四' },
    ];

    axios.get.mockResolvedValue({ data: mockUsers });

    const users = await fetchUsers();

    expect(axios.get).toHaveBeenCalledWith('/api/users');
    expect(users).toEqual(mockUsers);
  });

  it('應該處理請求失敗', async () => {
    axios.get.mockRejectedValue(new Error('網路錯誤'));

    await expect(fetchUsers()).rejects.toThrow('網路錯誤');
  });
});
```

### Mock 專案內的模組

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

// Mock 整個 api 模組
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
    it('應該呼叫正確的 URL', async () => {
      const mockUser = { id: 1, name: '張三' };
      api.get.mockResolvedValue({ data: mockUser });

      const result = await getUser(1);

      expect(api.get).toHaveBeenCalledWith('/users/1');
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('createUser', () => {
    it('應該傳送正確的資料', async () => {
      const newUser = { name: '王五', email: 'wangwu@example.com' };
      api.post.mockResolvedValue({ data: { id: 3, ...newUser } });

      const result = await createUser(newUser);

      expect(api.post).toHaveBeenCalledWith('/users', newUser);
      expect(result.data.id).toBe(3);
    });
  });
});
```

## Mock 日期和定時器

### Mock Date

```js
// 固定時間
const mockDate = new Date('2019-09-18T10:00:00Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

// 或使用 jest.setSystemTime（Jest 26+）
// jest.useFakeTimers('modern');
// jest.setSystemTime(new Date('2019-09-18'));

// 測試中
it('應該顯示正確的建立時間', () => {
  jest.spyOn(global, 'Date').mockImplementation(() => new Date('2019-09-18'));

  const component = render(<PostCard post={mockPost} />);
  expect(component.getByText('2019-09-18')).toBeInTheDocument();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

### Mock 定時器

```js
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('應該在 3 秒後顯示提示', () => {
  render(<AutoHideToast message="成功" duration={3000} />);

  expect(screen.getByText('成功')).toBeInTheDocument();

  // 快進 3 秒
  jest.advanceTimersByTime(3000);

  expect(screen.queryByText('成功')).not.toBeInTheDocument();
});

it('setInterval 應該每秒觸發', () => {
  const callback = jest.fn();

  setInterval(callback, 1000);

  jest.advanceTimersByTime(5000);

  expect(callback).toHaveBeenCalledTimes(5);
});
```

## Mock localStorage

```js
// 建立 localStorage mock
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

// 測試
it('應該儲存 token 到 localStorage', () => {
  saveToken('abc123');
  expect(localStorage.setItem).toHaveBeenCalledWith('token', 'abc123');
});

it('應該從 localStorage 讀取 token', () => {
  localStorage.getItem.mockReturnValue('abc123');
  expect(getToken()).toBe('abc123');
});
```

## Mock 專案中的工具函式

```js
// src/utils/logger.js
export function logError(error) {
  console.error('[ERROR]', error);
  // 上報到監控平臺
}

export function logInfo(message) {
  console.log('[INFO]', message);
}
```

```js
// 測試檔案中
import { processData } from '../dataProcessor';

// 部分 mock：只 mock logger，保留其他模組的真實實現
jest.mock('../utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

import { logError, logInfo } from '../utils/logger';

describe('dataProcessor', () => {
  it('處理失敗時應該記錄錯誤', () => {
    processData(null);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('資料為空')
    );
  });

  it('處理成功時應該記錄資訊', () => {
    processData({ id: 1 });
    expect(logInfo).toHaveBeenCalledWith(
      expect.stringContaining('處理完成')
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
// 測試中 mock 整個類
jest.mock('../services/ApiService', () => {
  return {
    ApiService: jest.fn().mockImplementation(() => ({
      fetch: jest.fn(),
    })),
  };
});

import { ApiService } from '../services/ApiService';

it('應該使用 ApiService 獲取資料', async () => {
  const mockInstance = new ApiService();
  mockInstance.fetch.mockResolvedValue({ id: 1, name: 'test' });

  // 被測程式碼會建立 ApiService 例項並呼叫 fetch
  const result = await someFunctionThatUsesApi();

  expect(ApiService).toHaveBeenCalledWith('https://api.example.com');
  expect(mockInstance.fetch).toHaveBeenCalledWith('/data');
});
```

## jest.spyOn 追蹤真實函式呼叫

```js
import { formatDate } from '../utils/date';

it('應該格式化日期', () => {
  const spy = jest.spyOn(console, 'log');

  someFunction('2019-09-18');

  expect(spy).toHaveBeenCalledWith('格式化後的日期:', '2019年09月18日');

  spy.mockRestore(); // 恢復原始實現
});

// spyOn 也可以替換實現
const mathSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
expect(Math.random()).toBe(0.5);
mathSpy.mockRestore();
```

## Mock 清理策略

```js
// jest.config.js
module.exports = {
  // 每個測試檔案執行前自動清除 mock
  clearMocks: true,
  // 自動恢復 mock（對 spyOn 有效）
  restoreMocks: true,
};

// 或手動清理
beforeEach(() => {
  jest.clearAllMocks();  // 清除呼叫記錄、返回值等
  jest.restoreAllMocks(); // 恢復 spyOn 的原始實現
  jest.resetModules();    // 重置模組快取
});
```

## 小結

- `jest.fn()` 建立 mock 函式，支援設定返回值（`mockReturnValue`）、實現（`mockImplementation`）和非同步行為（`mockResolvedValue`/`mockRejectedValue`）
- `jest.mock()` 可以 mock 整個模組，支援使用 `__mocks__` 目錄定義手動 mock
- `jest.spyOn()` 追蹤真實函式的呼叫，也可以替換實現
- 定時器使用 `jest.useFakeTimers()` + `jest.advanceTimersByTime()` 控制時間
- localStorage、fetch 等瀏覽器 API 需要在 setup 檔案中全域性 mock
- 始終在測試結束後清理 mock 狀態，避免測試間相互影響
- 部分 mock 可以只替換模組中的某些匯出，保留其他匯出的真實實現
