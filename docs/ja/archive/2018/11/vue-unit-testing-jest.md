---
title: "Vue 単体テスト入門：Jest + Vue Test Utils"
date: 2018-11-03 14:43:25
tags:
  - Vue
readingTime: 2
description: "テストを書くのは「時間があれば」と思っていましたが、コンポーネントが増えてきたら毎回コードを変更するのが怖くなりました。ついに時間をかけてテスト環境を構築し、早くやるべきだったと思いました。"
wordCount: 264
---

テストを書くのは「時間があれば」と思っていましたが、コンポーネントが増えてきたら毎回コードを変更するのが怖くなりました。ついに時間をかけてテスト環境を構築し、早くやるべきだったと思いました。

## インストール

```bash
# Vue CLI 3 でプロジェクト作成時に Unit Testing を選択、または手動で追加
vue add unit-jest

# 手動インストール
npm install -D @vue/test-utils jest vue-jest babel-jest
```

## 基本テスト：カウンターコンポーネント

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
  it("初期値は 0 であるべき", () => {
    const wrapper = shallowMount(Counter);
    expect(wrapper.find(".count").text()).toBe("0");
  });

  it("initialCount prop が有効", () => {
    const wrapper = shallowMount(Counter, {
      propsData: { initialCount: 5 },
    });
    expect(wrapper.find(".count").text()).toBe("5");
  });

  it("+1 ボタンをクリックすると count が増加", async () => {
    const wrapper = shallowMount(Counter);
    await wrapper.find("button").trigger("click");
    expect(wrapper.find(".count").text()).toBe("1");
  });

  it("-1 ボタンをクリックすると count が減少", async () => {
    const wrapper = shallowMount(Counter, {
      propsData: { initialCount: 5 },
    });
    await wrapper.findAll("button").at(1).trigger("click");
    expect(wrapper.find(".count").text()).toBe("4");
  });
});
```

## 非同期処理のテスト

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

it("ユーザーリストの読み込み成功", async () => {
  const mockUsers = [
    { id: 1, name: "田中" },
    { id: 2, name: "鈴木" },
  ];

  // $api をモック
  const wrapper = shallowMount(UserList, {
    mocks: {
      $api: {
        getUsers: jest.fn().mockResolvedValue(mockUsers),
      },
    },
  });

  // Promise の完了を待つ
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick(); // 2 回必要な場合がある

  expect(wrapper.vm.users).toEqual(mockUsers);
  expect(wrapper.vm.loading).toBe(false);
});
```

## イベント発火のテスト

```javascript
it("検索時に search イベントを発火", async () => {
  const wrapper = shallowMount(SearchBox);

  await wrapper.find("input").setValue("vue");
  await wrapper.find("form").trigger("submit");

  // 発火したイベントとパラメータをチェック
  expect(wrapper.emitted("search")).toBeTruthy();
  expect(wrapper.emitted("search")[0]).toEqual(["vue"]);
});
```

## よく使う jest.fn()

```javascript
const mockFn = jest.fn();
mockFn.mockReturnValue(42); // 固定値を返す
mockFn.mockResolvedValue({ id: 1 }); // Promise.resolve を返す
mockFn.mockRejectedValue(new Error("失敗")); // Promise.reject を返す

// 検証
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(3);
```

## まとめ

- `shallowMount`：シャローレンダリング（子コンポーネントはスタブ）。`mount` より速い
- `propsData`/`data`/`mocks`：コンポーネントの初期状態を制御
- `wrapper.find().trigger()`：ユーザーインタラクションをシミュレート
- `wrapper.emitted()`：コンポーネントが発火したイベントをチェック
- まずは重要なロジックのテストから書き始める。最初から 100% カバレッジを目指さない
