---
title: "ES2018 主要新特性速覽"
date: 2018-06-02 16:13:59
tags:
  - 前端
readingTime: 1
description: "ES2018 已經定稿，整理一下幾個最實用的新特性。"
wordCount: 134
---

ES2018 已經定稿，整理一下幾個最實用的新特性。

## Promise.finally

不管 Promise resolve 還是 reject，都會執行：

```javascript
fetch("/api/data")
  .then((res) => res.json())
  .catch((err) => console.error(err))
  .finally(() => {
    this.loading = false; // 無論成功失敗都關閉 loading
  });
```

比在 then 和 catch 裏各寫一遍 `loading = false` 優雅多了。

## 對象的 rest/spread（終於來了）

```javascript
// spread：複製並覆蓋屬性
const user = { name: "Alice", age: 25, role: "admin" };
const updated = { ...user, age: 26 };

// rest：提取剩餘屬性
const { role, ...userWithoutRole } = user;
// userWithoutRole = { name: 'Alice', age: 25 }
```

之前只有數組支持，對象 spread 是 ES2018 才正式進入標準。

## 異步迭代（for await...of）

```javascript
// 順序處理多個異步操作
async function processItems(ids) {
  for await (const item of fetchItems(ids)) {
    await saveItem(item);
  }
}

// 自定義異步迭代器
async function* generateSequence(start, end) {
  for (let i = start; i <= end; i++) {
    await delay(100);
    yield i;
  }
}

for await (const num of generateSequence(1, 5)) {
  console.log(num); // 1, 2, 3, 4, 5（每隔 100ms）
}
```

## 正則改進

```javascript
// 命名捕獲組（超實用）
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/
const match = '2018-06-02'.match(re)
const { year, month, day } = match.groups
// year='2018', month='06', day='02'

// s 修飾符：. 匹配換行符
const html = '<div>\n  content\n</div>'
/<div>(.*)<\/div>/s.test(html)  // true（之前需要 [\s\S]）

// 後行斷言
/(?<=\$)\d+/.exec('$100')  // 匹配 100（之前只有先行斷言）
```

## 小結

- `Promise.finally` 簡化了清理邏輯
- 對象 spread/rest 現在是正式標準
- `for await...of` 處理異步序列很方便
- 正則命名捕獲組大幅提升可讀性
