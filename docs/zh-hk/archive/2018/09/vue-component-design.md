---
title: "Vue 組件設計原則"
date: 2018-09-03 14:47:08
tags:
  - Vue
readingTime: 1
description: "寫了兩年 Vue，最近開始反思組件該怎麼設計。總結幾個讓組件更可維護的原則。"
wordCount: 220
---

寫了兩年 Vue，最近開始反思組件該怎麼設計。總結幾個讓組件更可維護的原則。

## 單一職責

每個組件只做一件事：

```javascript
// ❌ 一個組件做了太多事
// UserPage.vue：展示用户信息 + 處理權限 + 管理分頁 + 調用 API
export default {
  data() {
    return { user: null, permissions: [], list: [], page: 1 };
  },
  created() {
    this.fetchUser();
    this.fetchPermissions();
    this.fetchList();
  },
  // 200行代碼...
};

// ✅ 拆分關注點
// UserProfile.vue：只展示用户信息
// PermissionPanel.vue：權限管理
// UserList.vue：列表展示（含分頁）
// UserPage.vue：組合以上組件，處理頁面級邏輯
```

## Props 要儘量原子化

```javascript
{% raw %}
// ❌ 傳入整個 user 對象，組件依賴了對象的結構
props: { user: Object }
// 模板裏：{{ user.profile.avatar }}

// ✅ 只傳組件真正需要的數據
props: {
  name: String,
  avatarUrl: String,
  role: String
}
{% endraw %}
```

好處：組件更容易測試，依賴更清晰。

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

// ✅ 觸發事件，讓父組件修改
props: { value: String },
methods: {
  clear() { this.$emit('update:value', '') }
}

// 父組件
<MyInput :value="text" @update:value="text = $event" />
// 或用 .sync 語法糖
<MyInput :value.sync="text" />
```

## 可配置的默認值

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

受控組件：數據由父組件控制（通過 v-model / props）

```javascript
// 受控：父組件控制值
<SearchInput :value="searchText" @input="searchText = $event" />

// 非受控：內部自己管理狀態
// 只在需要時通過事件向外拋出結果
<DatePicker @change="handleDateSelect" />
```

根據場景選擇，不是所有狀態都需要提升到父組件。

## 文檔化

哪怕只是註釋，也要説明 prop 的用途：

```javascript
props: {
  // 列表數據，格式：[{ id, name, status }]
  items: {
    type: Array,
    required: true
  },
  // 選中項的 id，支持 .sync 雙向綁定
  selectedId: {
    type: [Number, null],
    default: null
  }
}
```

## 小結

- 單一職責：一個組件只做一件事，拆分是美德
- Props 原子化：只傳真正需要的數據
- 用事件描述行為，不要直接修改 props
- 組件要有合理的默認值和參數校驗
