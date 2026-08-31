---
title: "Vue 深度監聽和監聽陣列"
date: 2018-05-01 09:32:57
tags:
  - Vue
readingTime: 1
description: "Vue 的響應式系統對物件屬性和陣列有一些特殊限制，搞清楚這些才能正確用 `watch`。"
wordCount: 226
---

Vue 的響應式系統對物件屬性和陣列有一些特殊限制，搞清楚這些才能正確用 `watch`。

## 監聽物件：deep 選項

```javascript
export default {
  data() {
    return {
      form: {
        name: "",
        age: 0,
        address: {
          city: "",
          street: "",
        },
      },
    };
  },
  watch: {
    // 預設：只監聽 form 引用變化（換了一個新物件才觸發）
    form(newVal, oldVal) {
      // form.name 變了不會觸發
    },

    // deep: true：監聽內部所有屬性的變化
    form: {
      handler(newVal) {
        console.log("表單變了", newVal);
      },
      deep: true,
    },
  },
};
```

**deep 的代價**：會遍歷物件所有屬性，效能開銷大。如果只關心某個屬性，直接監聽那個路徑：

```javascript
watch: {
  // 監聽巢狀屬性（用字串路徑）
  'form.address.city'(newVal) {
    console.log('城市變了', newVal)
  }
}
```

## Vue 對陣列的限制

Vue 2 不能檢測以下陣列變動：

```javascript
// ❌ Vue 檢測不到
this.list[0] = "new value"; // 直接用索引賦值
this.list.length = 0; // 直接修改 length

// ✅ 正確的做法
this.$set(this.list, 0, "new value"); // 或者：
Vue.set(this.list, 0, "new value");

this.list.splice(0, this.list.length); // 清空陣列
```

Vue 封裝了這些陣列方法，使用它們可以觸發更新：

```javascript
// 這些方法 Vue 做了封裝，會觸發檢視更新
this.list.push(item);
this.list.pop();
this.list.shift();
this.list.unshift(item);
this.list.splice(index, 1);
this.list.sort();
this.list.reverse();

// 這些不會觸發（返回新陣列）→ 需要賦值回去
this.list = this.list.filter((x) => x > 1);
this.list = this.list.map((x) => x * 2);
this.list = this.list.concat([4, 5]);
```

## 監聽陣列

```javascript
watch: {
  // 監聽陣列，直接寫（不需要 deep，陣列 push/pop 等能被檢測到）
  list(newVal) {
    console.log('list 變了', newVal)
  },

  // 如果要監聽數組裡每個物件的屬性變化，需要 deep
  userList: {
    handler(newVal) {
      console.log('user 屬性變化')
    },
    deep: true
  }
}
```

## immediate：初始化時立即執行

```javascript
watch: {
  userId: {
    handler(id) {
      this.loadUserData(id)
    },
    immediate: true  // 元件建立時就執行一次，而不是等資料變化
  }
}
```

等價於：

```javascript
created() {
  this.loadUserData(this.userId)
},
watch: {
  userId(id) {
    this.loadUserData(id)
  }
}
```

用 `immediate: true` 更簡潔。

## 小結

- 監聽物件屬性變化：`deep: true`，但有效能開銷
- 監聽特定巢狀屬性：直接寫字串路徑，比 `deep` 更高效
- Vue 2 陣列限制：索引賦值和 length 變化檢測不到，用 `$set` 或陣列方法
- `immediate: true`：初始化時立即執行，避免寫重複程式碼