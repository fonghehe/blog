---
title: "Vue 组件设计原则"
date: 2018-09-03 14:47:08
tags:
  - Vue
readingTime: 1
description: "写了两年 Vue，最近开始反思组件该怎么设计。总结几个让组件更可维护的原则。"
---

写了两年 Vue，最近开始反思组件该怎么设计。总结几个让组件更可维护的原则。

## 单一职责

每个组件只做一件事：

```javascript
// ❌ 一个组件做了太多事
// UserPage.vue：展示用户信息 + 处理权限 + 管理分页 + 调用 API
export default {
  data() {
    return { user: null, permissions: [], list: [], page: 1 };
  },
  created() {
    this.fetchUser();
    this.fetchPermissions();
    this.fetchList();
  },
  // 200行代码...
};

// ✅ 拆分关注点
// UserProfile.vue：只展示用户信息
// PermissionPanel.vue：权限管理
// UserList.vue：列表展示（含分页）
// UserPage.vue：组合以上组件，处理页面级逻辑
```

## Props 要尽量原子化

```javascript
{% raw %}
// ❌ 传入整个 user 对象，组件依赖了对象的结构
props: { user: Object }
// 模板里：{{ user.profile.avatar }}

// ✅ 只传组件真正需要的数据
props: {
  name: String,
  avatarUrl: String,
  role: String
}
{% endraw %}
```

好处：组件更容易测试，依赖更清晰。

## 事件命名：用动词

```javascript
// ❌ 事件名含糊
this.$emit("click");
this.$emit("change");
this.$emit("update");

// ✅ 事件名描述发生了什么
this.$emit("user:saved", savedUser);
this.$emit("filter:changed", newFilter);
this.$emit("item:deleted", itemId);
```

## 避免直接修改 Props

```javascript
// ❌ 修改 prop（Vue 会警告）
props: { value: String },
methods: {
  clear() { this.value = '' }  // 不能这样做！
}

// ✅ 触发事件，让父组件修改
props: { value: String },
methods: {
  clear() { this.$emit('update:value', '') }
}

// 父组件
<MyInput :value="text" @update:value="text = $event" />
// 或用 .sync 语法糖
<MyInput :value.sync="text" />
```

## 可配置的默认值

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

## 受控与非受控

受控组件：数据由父组件控制（通过 v-model / props）

```javascript
// 受控：父组件控制值
<SearchInput :value="searchText" @input="searchText = $event" />

// 非受控：内部自己管理状态
// 只在需要时通过事件向外抛出结果
<DatePicker @change="handleDateSelect" />
```

根据场景选择，不是所有状态都需要提升到父组件。

## 文档化

哪怕只是注释，也要说明 prop 的用途：

```javascript
props: {
  // 列表数据，格式：[{ id, name, status }]
  items: {
    type: Array,
    required: true
  },
  // 选中项的 id，支持 .sync 双向绑定
  selectedId: {
    type: [Number, null],
    default: null
  }
}
```

## 小结

- 单一职责：一个组件只做一件事，拆分是美德
- Props 原子化：只传真正需要的数据
- 用事件描述行为，不要直接修改 props
- 组件要有合理的默认值和参数校验
