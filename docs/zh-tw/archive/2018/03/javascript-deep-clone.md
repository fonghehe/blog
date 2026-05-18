---
title: "JavaScript 深複製的幾種方案"
date: 2018-03-17 11:08:16
tags:
  - JavaScript
readingTime: 2
description: "深複製在前端場景裡很常見，但實現起來有很多坑。整理一下各種方案的適用場景和侷限性。"
---

深複製在前端場景裡很常見，但實現起來有很多坑。整理一下各種方案的適用場景和侷限性。

## 淺複製 vs 深複製

```javascript
const obj = { name: "Alice", address: { city: "北京" } };

// 淺複製：只複製第一層，巢狀引用還是同一個
const shallow = { ...obj };
shallow.address.city = "上海";
console.log(obj.address.city); // '上海'，原物件被修改了！

// 深複製：完全獨立，修改不影響原物件
const deep = deepClone(obj);
deep.address.city = "上海";
console.log(obj.address.city); // '北京'，原物件不受影響
```

## 方案一：JSON 序列化

```javascript
const clone = JSON.parse(JSON.stringify(obj));
```

**優點**：簡單，一行程式碼

**缺點**：

- 無法處理 `undefined`、函式、Symbol（會被丟棄）
- 無法處理迴圈引用（會報錯）
- `Date` 物件會變成字串
- `NaN`、`Infinity` 變成 `null`
- 不保留 `RegExp`

```javascript
const obj = {
  undef: undefined, // 丟失
  fn: () => {}, // 丟失
  date: new Date(), // 變成字串 "2018-03-17T..."
  regex: /test/g, // 變成空物件 {}
  nan: NaN, // 變成 null
};

const clone = JSON.parse(JSON.stringify(obj));
// { date: "2018-03-17T...", nan: null }
```

**適用場景**：純資料物件（沒有特殊型別），快速臨時用。

## 方案二：遞迴實現

```javascript
function deepClone(source, cache = new WeakMap()) {
  // 基礎型別直接返回
  if (source === null || typeof source !== "object") return source;

  // 處理迴圈引用
  if (cache.has(source)) return cache.get(source);

  // 處理特殊型別
  if (source instanceof Date) return new Date(source.getTime());
  if (source instanceof RegExp) return new RegExp(source.source, source.flags);

  // 建立空物件/陣列
  const target = Array.isArray(source) ? [] : {};
  cache.set(source, target);

  // 遞迴複製每個屬性
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = deepClone(source[key], cache);
    }
  }

  return target;
}
```

測試：

```javascript
const original = {
  name: "Alice",
  address: { city: "北京" },
  hobbies: ["coding", "reading"],
  date: new Date(),
  regex: /test/g,
};

// 迴圈引用測試
original.self = original;

const cloned = deepClone(original);
cloned.address.city = "上海";

console.log(original.address.city); // '北京'，不受影響
console.log(cloned.self === cloned); // true，迴圈引用正確處理
console.log(cloned.date instanceof Date); // true
```

## 方案三：structuredClone（現代瀏覽器）

2022 年各瀏覽器開始原生支援，2018 年還不可用，但值得了解：

```javascript
// 未來可用（Chrome 98+, Firefox 94+, Node 17+）
const clone = structuredClone(obj);
```

支援大多數型別，但不支援函式和 Symbol。

## 方案四：lodash.cloneDeep

生產環境最可靠的方案：

```javascript
import cloneDeep from "lodash/cloneDeep";

const clone = cloneDeep(source);
```

lodash 的實現處理了各種邊界情況，是最穩健的選擇。

## 實際專案中怎麼選

| 場景                       | 推薦方案                       |
| 
-------------------------- | ------------------------------ |
| 純資料物件，快速使用       | `JSON.parse(JSON.stringify())` |
| 需要處理 Date/RegExp       | lodash `cloneDeep`             |
| 不想引入依賴，已知資料結構 | 自己寫遞迴                     |
| 表單 reset，儲存初始值     | lodash `cloneDeep`             |

```javascript
// 表單場景：儲存初始值，用於重置
import cloneDeep from 'lodash/cloneDeep'

data() {
  return {
    form: { name: '', email: '' },
    originalForm: null
  }
},
created() {
  this.loadData()
},
methods: {
  async loadData() {
    const data = await fetchFormData()
    this.form = data
    this.originalForm = cloneDeep(data)  // 儲存初始狀態
  },
  handleReset() {
    this.form = cloneDeep(this.originalForm)  // 恢復
  }
}
```

## 小結

- 簡單場景用 `JSON.parse(JSON.stringify())`，但瞭解它的限制
- 生產程式碼推薦 `lodash/cloneDeep`，省心
- 如果追求零依賴，手寫遞迴方案，記得處理迴圈引用
