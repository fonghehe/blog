---
title: "Vue 單元測試入門：Jest + Vue Test Utils"
date: 2018-11-03 14:43:25
tags:
  - Vue
readingTime: 2
description: "一直覺得寫測試是\"有時間再寫\"的事，但元件越來越多之後，每次改程式碼都提心吊膽。終於花時間搭了測試環境，現在覺得早該寫了。"
wordCount: 151
---

一直覺得寫測試是"有時間再寫"的事，但元件越來越多之後，每次改程式碼都提心吊膽。終於花時間搭了測試環境，現在覺得早該寫了。

## 安裝

```bash
# Vue CLI 3 建立專案時選 Unit Testing，或者手動新增
vue add unit-jest

# 手動安裝
npm install -D @vue/test-utils jest vue-jest babel-jest
```

## 基礎測試：一個計數器元件

```javascript
{% raw %}
// components/Counter.vue
<template>
  <div>
    <span class="count">{{ count }}</span>
    <button @click="increment">+1</button>
    <button @click="decrement">-1</button>
  </div>
</template>

<script>
export default {
  props: {
    initialCount: { type: Number, default: 0 }
  },
  data() {
    return { count: this.initialCount }
  },
  methods: {
    increment() { this.count++ },
    decrement() { this.count-- }
  }
}
</script>
{% endraw %}
```

```javascript
// tests/unit/Counter.spec.js
import { shallowMount } from "@vue/test-utils";
import Counter from "@/components/Counter.vue";

describe("Counter", () => {
  it("初始值應為 0", () => {
    const wrapper = shallowMount(Counter);
    expect(wrapper.find(".count").text()).toBe("0");
  });

  it("initialCount prop 生效", () => {
    const wrapper = shallowMount(Counter, {
      propsData: { initialCount: 5 },
    });
    expect(wrapper.find(".count").text()).toBe("5");
  });

  it("點選 +1 按鈕，count 增加", async () => {
    const wrapper = shallowMount(Counter);
    await wrapper.find("button").trigger("click");
    expect(wrapper.find(".count").text()).toBe("1");
  });

  it("點選 -1 按鈕，count 減少", async () => {
    const wrapper = shallowMount(Counter, {
      propsData: { initialCount: 5 },
    });
    await wrapper.findAll("button").at(1).trigger("click");
    expect(wrapper.find(".count").text()).toBe("4");
  });
});
```

## 測試非同步操作

```javascript
// components/UserList.vue
export default {
  data() {
    return { users: [], loading: false };
  },
  created() {
    this.fetchUsers();
  },
  methods: {
    async fetchUsers() {
      this.loading = true;
      this.users = await this.$api.getUsers();
      this.loading = false;
    },
  },
};
```

```javascript
// tests/unit/UserList.spec.js
import { shallowMount } from "@vue/test-utils";
import UserList from "@/components/UserList.vue";

it("成功載入使用者列表", async () => {
  const mockUsers = [
    { id: 1, name: "張三" },
    { id: 2, name: "李四" },
  ];

  // 模擬 $api
  const wrapper = shallowMount(UserList, {
    mocks: {
      $api: {
        getUsers: jest.fn().mockResolvedValue(mockUsers),
      },
    },
  });

  // 等待 Promise 完成
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick(); // 有時候需要等兩個 tick

  expect(wrapper.vm.users).toEqual(mockUsers);
  expect(wrapper.vm.loading).toBe(false);
});
```

## 測試事件觸發

```javascript
it("搜尋時觸發 search 事件", async () => {
  const wrapper = shallowMount(SearchBox);

  await wrapper.find("input").setValue("vue");
  await wrapper.find("form").trigger("submit");

  // 檢查觸發的事件和引數
  expect(wrapper.emitted("search")).toBeTruthy();
  expect(wrapper.emitted("search")[0]).toEqual(["vue"]);
});
```

## 常用 jest.fn()

```javascript
const mockFn = jest.fn();
mockFn.mockReturnValue(42); // 返回固定值
mockFn.mockResolvedValue({ id: 1 }); // 返回 Promise.resolve
mockFn.mockRejectedValue(new Error("失敗")); // 返回 Promise.reject

// 驗證
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(3);
```

## 小結

- `shallowMount`：淺渲染（子元件變成 stub），比 `mount` 快
- `propsData`/`data`/`mocks`：控制組件初始狀態
- `wrapper.find().trigger()`：模擬使用者互動
- `wrapper.emitted()`：檢查元件觸發的事件
- 先從關鍵邏輯開始寫測試，不要一開始就追求 100% 覆蓋率
