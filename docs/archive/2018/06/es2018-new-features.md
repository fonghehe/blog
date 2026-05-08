---
title: "ES2018 主要新特性速览"
date: 2018-06-02 16:13:59
tags:
  - 前端
---

ES2018 已经定稿，整理一下几个最实用的新特性。

## Promise.finally

不管 Promise resolve 还是 reject，都会执行：

```javascript
fetch("/api/data")
  .then((res) => res.json())
  .catch((err) => console.error(err))
  .finally(() => {
    this.loading = false; // 无论成功失败都关闭 loading
  });
```

比在 then 和 catch 里各写一遍 `loading = false` 优雅多了。

## 对象的 rest/spread（终于来了）

```javascript
// spread：复制并覆盖属性
const user = { name: "Alice", age: 25, role: "admin" };
const updated = { ...user, age: 26 };

// rest：提取剩余属性
const { role, ...userWithoutRole } = user;
// userWithoutRole = { name: 'Alice', age: 25 }
```

之前只有数组支持，对象 spread 是 ES2018 才正式进入标准。

## 异步迭代（for await...of）

```javascript
// 顺序处理多个异步操作
async function processItems(ids) {
  for await (const item of fetchItems(ids)) {
    await saveItem(item);
  }
}

// 自定义异步迭代器
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

## 正则改进

```javascript
// 命名捕获组（超实用）
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/
const match = '2018-06-02'.match(re)
const { year, month, day } = match.groups
// year='2018', month='06', day='02'

// s 修饰符：. 匹配换行符
const html = '<div>\n  content\n</div>'
/<div>(.*)<\/div>/s.test(html)  // true（之前需要 [\s\S]）

// 后行断言
/(?<=\$)\d+/.exec('$100')  // 匹配 100（之前只有先行断言）
```

## 小结

- `Promise.finally` 简化了清理逻辑
- 对象 spread/rest 现在是正式标准
- `for await...of` 处理异步序列很方便
- 正则命名捕获组大幅提升可读性
