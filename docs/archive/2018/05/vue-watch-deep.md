---
title: "Vue 深度监听和监听数组"
date: 2018-05-01 09:32:57
tags:
  - Vue
readingTime: 1
description: "Vue 的响应式系统对对象属性和数组有一些特殊限制，搞清楚这些才能正确用 `watch`。"
wordCount: 226
---

Vue 的响应式系统对对象属性和数组有一些特殊限制，搞清楚这些才能正确用 `watch`。

## 监听对象：deep 选项

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
    // 默认：只监听 form 引用变化（换了一个新对象才触发）
    form(newVal, oldVal) {
      // form.name 变了不会触发
    },

    // deep: true：监听内部所有属性的变化
    form: {
      handler(newVal) {
        console.log("表单变了", newVal);
      },
      deep: true,
    },
  },
};
```

**deep 的代价**：会遍历对象所有属性，性能开销大。如果只关心某个属性，直接监听那个路径：

```javascript
watch: {
  // 监听嵌套属性（用字符串路径）
  'form.address.city'(newVal) {
    console.log('城市变了', newVal)
  }
}
```

## Vue 对数组的限制

Vue 2 不能检测以下数组变动：

```javascript
// ❌ Vue 检测不到
this.list[0] = "new value"; // 直接用索引赋值
this.list.length = 0; // 直接修改 length

// ✅ 正确的做法
this.$set(this.list, 0, "new value"); // 或者：
Vue.set(this.list, 0, "new value");

this.list.splice(0, this.list.length); // 清空数组
```

Vue 封装了这些数组方法，使用它们可以触发更新：

```javascript
// 这些方法 Vue 做了封装，会触发视图更新
this.list.push(item);
this.list.pop();
this.list.shift();
this.list.unshift(item);
this.list.splice(index, 1);
this.list.sort();
this.list.reverse();

// 这些不会触发（返回新数组）→ 需要赋值回去
this.list = this.list.filter((x) => x > 1);
this.list = this.list.map((x) => x * 2);
this.list = this.list.concat([4, 5]);
```

## 监听数组

```javascript
watch: {
  // 监听数组，直接写（不需要 deep，数组 push/pop 等能被检测到）
  list(newVal) {
    console.log('list 变了', newVal)
  },

  // 如果要监听数组里每个对象的属性变化，需要 deep
  userList: {
    handler(newVal) {
      console.log('user 属性变化')
    },
    deep: true
  }
}
```

## immediate：初始化时立即执行

```javascript
watch: {
  userId: {
    handler(id) {
      this.loadUserData(id)
    },
    immediate: true  // 组件创建时就执行一次，而不是等数据变化
  }
}
```

等价于：

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

用 `immediate: true` 更简洁。

## 小结

- 监听对象属性变化：`deep: true`，但有性能开销
- 监听特定嵌套属性：直接写字符串路径，比 `deep` 更高效
- Vue 2 数组限制：索引赋值和 length 变化检测不到，用 `$set` 或数组方法
- `immediate: true`：初始化时立即执行，避免写重复代码