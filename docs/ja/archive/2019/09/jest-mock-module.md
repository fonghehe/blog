---
title: "Jest Mock：モジュールと関数のモック完全ガイド"
date: 2019-09-18 16:13:14
tags:
  - エンジニアリング
readingTime: 4
description: "单元测试中经常需要隔离被测代码的依赖：替换 API 调用、模拟定时器、mock 第三方库。Jest 提供了一套完整的 mock 工具链，从简单的函数 mock 到模块级别的替换，覆盖了绝大多数测试场景。本文将系统讲解 Jest 中各种 mock 的用法和最佳实践。"
wordCount: 530
---

ユニットテストでは、テスト対象のコードが依存するものを分離する必要がたびたび生じる。API 呼び出しの置き換え、タイマーのシミュレーション、サードパーティライブラリの mock などだ。Jest は、単純な関数の mock からモジュールレベルの置き換えまでをカバーする、一連の mock ツールチェーンを提供している。本記事では Jest における各種 mock の使い方とベストプラクティスを系統的に解説する。

## Mock 関数の基本

### jest.fn() で mock 関数を作成する

```js
// mock関数を作成
const mockFn = jest.fn();

// 呼び出し
mockFn();
mockFn('hello', 'world');
mockFn(42);

// アサーション
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(3);
expect(mockFn).toHaveBeenCalledWith('hello', 'world');
expect(mockFn).toHaveBeenLastCalledWith(42);
```

### 戻り値の設定

```js
const mockFn = jest.fn();

// 固定戻り値
mockFn.mockReturnValue(42);
expect(mockFn()).toBe(42);

// 呼び出しごとに異なる値を返す
mockFn
  .mockReturnValueOnce('first')
  .mockReturnValueOnce('second')
  .mockReturnValue('default');

expect(mockFn()).toBe('first');
expect(mockFn()).toBe('second');
expect(mockFn()).toBe('default');
expect(mockFn()).toBe('default');

// 非同期戻り値
const asyncMock = jest.fn();
asyncMock.mockResolvedValue({ data: 'success' });
// またはmockResolvedValueOnce

const result = await asyncMock();
expect(result).toEqual({ data: 'success' });

// 非同期リジェクション
asyncMock.mockRejectedValue(new Error('ネットワークエラー'));
await expect(asyncMock()).rejects.toThrow('ネットワークエラー');
```

### 実装の設定

```js
const mockFn = jest.fn();

// カスタム実装
mockFn.mockImplementation((a, b) => a + b);
expect(mockFn(1, 2)).toBe(3);

// 呼び出しごとに異なる実装
mockFn
  .mockImplementationOnce(() => 'first')
  .mockImplementationOnce(() => 'second');

expect(mockFn()).toBe('first');
expect(mockFn()).toBe('second');

// 非同期実装
const asyncMock = jest.fn();
asyncMock.mockImplementation(async () => {
  const result = await someAsyncOperation();
  return result;
});
```

## モジュール全体の mock

### サードパーティライブラリの mock

```js
// __mocks__/axios.js（node_modulesと同階層の__mocks__ディレクトリに配置）
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

テストファイル内で：

```js
import axios from 'axios';
import { fetchUsers } from './userService';

// 自動的に__mocks__/axios.jsを使用
jest.mock('axios');

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // 各テスト前にmockの状態をクリア
  });

  it('ユーザー一覧を正しく取得できること', async () => {
    const mockUsers = [
      { id: 1, name: '張三' },
      { id: 2, name: '李四' },
    ];

    axios.get.mockResolvedValue({ data: mockUsers });

    const users = await fetchUsers();

    expect(axios.get).toHaveBeenCalledWith('/api/users');
    expect(users).toEqual(mockUsers);
  });

  it('リクエスト失敗を処理すること', async () => {
    axios.get.mockRejectedValue(new Error('ネットワークエラー'));

    await expect(fetchUsers()).rejects.toThrow('ネットワークエラー');
  });
});
```

### プロジェクト内モジュールの mock

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

// apiモジュール全体をモック
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
    it('正しいURLを呼び出すこと', async () => {
      const mockUser = { id: 1, name: '張三' };
      api.get.mockResolvedValue({ data: mockUser });

      const result = await getUser(1);

      expect(api.get).toHaveBeenCalledWith('/users/1');
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('createUser', () => {
    it('正しいデータを送信すること', async () => {
      const newUser = { name: '王五', email: 'wangwu@example.com' };
      api.post.mockResolvedValue({ data: { id: 3, ...newUser } });

      const result = await createUser(newUser);

      expect(api.post).toHaveBeenCalledWith('/users', newUser);
      expect(result.data.id).toBe(3);
    });
  });
});
```

## 日付とタイマーの mock

### Mock Date

```js
// 時刻を固定
const mockDate = new Date('2019-09-18T10:00:00Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

// またはjest.setSystemTimeを使用（Jest 26+）
// jest.useFakeTimers('modern');
// jest.setSystemTime(new Date('2019-09-18'));

// テスト内
it('正しい作成日時が表示されること', () => {
  jest.spyOn(global, 'Date').mockImplementation(() => new Date('2019-09-18'));

  const component = render(<PostCard post={mockPost} />);
  expect(component.getByText('2019-09-18')).toBeInTheDocument();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

### タイマーの mock

```js
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('3秒後にトーストが表示されること', () => {
  render(<AutoHideToast message="成功" duration={3000} />);

  expect(screen.getByText('成功')).toBeInTheDocument();

  // 3秒進める
  jest.advanceTimersByTime(3000);

  expect(screen.queryByText('成功')).not.toBeInTheDocument();
});

it('setIntervalが毎秒発火すること', () => {
  const callback = jest.fn();

  setInterval(callback, 1000);

  jest.advanceTimersByTime(5000);

  expect(callback).toHaveBeenCalledTimes(5);
});
```

## Mock localStorage

```js
// localStorageのモックを作成
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

// テスト
it('tokenをlocalStorageに保存できること', () => {
  saveToken('abc123');
  expect(localStorage.setItem).toHaveBeenCalledWith('token', 'abc123');
});

it('localStorageからtokenを読み取れること', () => {
  localStorage.getItem.mockReturnValue('abc123');
  expect(getToken()).toBe('abc123');
});
```

## プロジェクト内ユーティリティ関数の mock

```js
// src/utils/logger.js
export function logError(error) {
  console.error('[ERROR]', error);
  // 監視プラットフォームに送信
}

export function logInfo(message) {
  console.log('[INFO]', message);
}
```

```js
// テスト文件中
import { processData } from '../dataProcessor';

// 部分モック：loggerのみモックし、他のモジュールの実装は保持
jest.mock('../utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

import { logError, logInfo } from '../utils/logger';

describe('dataProcessor', () => {
  it('処理失敗時にエラーを記録すること', () => {
    processData(null);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('データが空です')
    );
  });

  it('処理成功時に情報を記録すること', () => {
    processData({ id: 1 });
    expect(logInfo).toHaveBeenCalledWith(
      expect.stringContaining('処理完了')
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
// テスト内 mock 整个类
jest.mock('../services/ApiService', () => {
  return {
    ApiService: jest.fn().mockImplementation(() => ({
      fetch: jest.fn(),
    })),
  };
});

import { ApiService } from '../services/ApiService';

it('ApiServiceを使ってデータを取得できること', async () => {
  const mockInstance = new ApiService();
  mockInstance.fetch.mockResolvedValue({ id: 1, name: 'test' });

  // テスト対象コードがApiServiceインスタンスを作成しfetchを呼び出す
  const result = await someFunctionThatUsesApi();

  expect(ApiService).toHaveBeenCalledWith('https://api.example.com');
  expect(mockInstance.fetch).toHaveBeenCalledWith('/data');
});
```

## jest.spyOn で実際の関数呼び出しを追跡する

```js
import { formatDate } from '../utils/date';

it('日付をフォーマットできること', () => {
  const spy = jest.spyOn(console, 'log');

  someFunction('2019-09-18');

  expect(spy).toHaveBeenCalledWith('フォーマット後の日付:', '2019年09月18日');

  spy.mockRestore(); // 元の実装を復元
});

// spyOnで実装を置き換えることも可能
const mathSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
expect(Math.random()).toBe(0.5);
mathSpy.mockRestore();
```

## mock のクリーンアップ戦略

```js
// jest.config.js
module.exports = {
  // 各テストファイル実行前に自動でmockをクリア
  clearMocks: true,
  // 自動でmockを復元（spyOnに有効）
  restoreMocks: true,
};

// または手動でクリーンアップ
beforeEach(() => {
  jest.clearAllMocks();  // 呼び出し履歴、戻り値などをクリア
  jest.restoreAllMocks(); // spyOnの元の実装を復元
  jest.resetModules();    // モジュールキャッシュをリセット
});
```

## まとめ

- `jest.fn()` でmock関数を作成し、戻り値（`mockReturnValue`）・実装（`mockImplementation`）・非同期動作（`mockResolvedValue`/`mockRejectedValue`）を設定できる
- `jest.mock()` でモジュール全体をモックでき、`__mocks__` ディレクトリで手動モックを定義できる
- `jest.spyOn()` で実際の関数呼び出しを追跡でき、実装の置き換えも可能
- タイマーは `jest.useFakeTimers()` + `jest.advanceTimersByTime()` で時間を制御する
- localStorageやfetchなどのブラウザAPIは、setupファイルでグローバルにモックする必要がある
- テスト終了後は必ずmockの状態をクリーンアップし、テスト間の相互影響を防ぐ
- 部分モックでモジュール内の一部のエクスポートのみを置き換え、他のエクスポートの実装は保持できる
