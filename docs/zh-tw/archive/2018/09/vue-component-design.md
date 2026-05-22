---
title: "Vue 元件設計原則"
date: 2018-09-03 14:47:08
tags:
  - Vue
readingTime: 1
description: "寫了兩年 Vue，最近開始反思元件該怎麼設計。總結幾個讓元件更可維護的原則。"
wordCount: 220
---

寫了兩年 Vue，最近開始反思元件該怎麼設計。總結幾個讓元件更可維護的原則。

## 單一職責

每個元件隻做一件事：

```javascript
// ❌ 一個元件做了太多事
// UserPage.vue：展示使用者資訊 + 處理許可權 + 管理分頁 + 呼叫 API
export default {
  data() {
    return { user: null, permissions: [], list: [], page: 1 };
  },
  created() {
    this.fetchUser();
    this.fetchPermissions();
    this.fetchList();
  },
  // 200行程式碼...
};

// ✅ 拆分關注點
// UserProfile.vue：隻展示使用者資訊
// PermissionPanel.vue：許可權管理
// UserList.vue：列表展示（含分頁）
// UserPage.vue：組合以上元件，處理頁面級邏輯
```

## Props 要儘量原子化

```javascript
{% raw %}
// ❌ 傳入整個 user 物件，元件依賴了物件的結構
props: { user: Object }
// 模板裡：{{ user.profile.avatar }}

// ✅ 隻傳元件真正需要的資料
props: {
  name: String,
  avatarUrl: String,
  role: String
}
{% endraw %}
```

好處：元件更容易測試，依賴更清晰。

## 事件命名：用動詞

```javascript
// ❌ 事件名含糊
this.$emit("click");
this.$emit("change");
this.$emit("update");

// ✅ 事件名描述發生了什麼
this.$emit("user:saved", savedUser);
this.$emit("filter:changed", newFilter);
this.$emit("item:deleted", itemId);
```

## 避免直接修改 Props

```javascript
// ❌ 修改 prop（Vue 會警告）
props: { value: String },
methods: {
  clear() { this.value = '' }  // 不能這樣做！
}

// ✅ 觸發事件，讓父元件修改
props: { value: String },
methods: {
  clear() { this.$emit('update:value', '') }
}

// 父元件
<MyInput :value="text" @update:value="text = $event" />
// 或用 .sync 語法糖
<MyInput :value.sync="text" />
```

## 可設定的預設值

```javascript
props: {
  size: {
    type: String,
    default: 'medium',
    validator: (v) => ['small', 'medium', 'large'].includes(v)
  },
  loading: {
    type: Boolean,
    default: false
  }
}
```

## 受控與非受控

受控元件：資料由父元件控製（通過 v-model / props）

```javascript
// 受控：父元件控製值
<SearchInput :value="searchText" @input="searchText = $event" />

// 非受控：內部自己管理狀態
// 隻在需要時通過事件向外丟擲結果
<DatePicker @change="handleDateSelect" />
```

根據場景選擇，不是所有狀態都需要提升到父元件。

## 檔案化

哪怕隻是註釋，也要說明 prop 的用途：

```javascript
props: {
  // 列表資料，格式：[{ id, name, status }]
  items: {
    type: Array,
    required: true
  },
  // 選中項的 id，支援 .sync 雙向繫結
  selectedId: {
    type: [Number, null],
    default: null
  }
}
```

## 小結

- 單一職責：一個元件隻做一件事，拆分是美德
- Props 原子化：隻傳真正需要的資料
- 用事件描述行為，不要直接修改 props
- 元件要有合理的預設值和引數校驗
