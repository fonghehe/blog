---
title: "Vue 元件單元測試實戰"
date: 2020-05-28 16:10:29
tags:
  - Vue
readingTime: 3
description: "之前寫了一篇測試實踐指南，這篇專門針對 Vue 元件的單元測試深入展開。管理後臺專案裡有 200+ 元件，要保證重構時不 break，測試必須跟上。"
wordCount: 172
---

之前寫了一篇測試實踐指南，這篇專門針對 Vue 元件的單元測試深入展開。管理後臺專案裡有 200+ 元件，要保證重構時不 break，測試必須跟上。

## 環境搭建

```bash
npm install -D jest @vue/test-utils vue-jest babel-jest @babel/core @babel/preset-env

# Vue 2
npm install -D vue-template-compiler vue@2

# ts 支援
npm install -D ts-jest @types/jest typescript
```

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['js', 'ts', 'vue', 'json'],
  transform: {
    '^.+\\.vue$': 'vue-jest',
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // 覆蓋率
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
```

## 測試純展示元件

```vue
<!-- Tag.vue -->
<template>
  <span :class="['tag', `tag--${type}`]" @click="$emit('click', $event)">
    <slot />
  </span>
</template>

<script>
export default {
  name: 'Tag',
  props: {
    type: {
      type: String,
      default: 'default',
      validator: v => ['default', 'success', 'warning', 'danger'].includes(v),
    },
  },
};
</script>
```

```typescript
// __tests__/Tag.test.ts
import { mount } from '@vue/test-utils';
import Tag from '@/components/Tag.vue';

describe('Tag', () => {
  it('渲染插槽內容', () => {
    const wrapper = mount(Tag, {
      slots: { default: '標籤內容' },
    });
    expect(wrapper.text()).toBe('標籤內容');
  });

  it('預設型別是 default', () => {
    const wrapper = mount(Tag);
    expect(wrapper.classes()).toContain('tag--default');
  });

  it('設定 type 後有對應類名', () => {
    const wrapper = mount(Tag, {
      propsData: { type: 'success' },
    });
    expect(wrapper.classes()).toContain('tag--success');
  });

  it('點選時觸發 click 事件', async () => {
    const wrapper = mount(Tag);
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('type 校驗失敗時在控製臺警告', () => {
    const warnSpy = jest.spyOn(console, 'error').mockImplementation();
    mount(Tag, {
      propsData: { type: 'unknown' },
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
```

## 測試表單元件

```typescript
// __tests__/SearchForm.test.ts
import { mount } from '@vue/test-utils';
import SearchForm from '@/components/SearchForm.vue';

describe('SearchForm', () => {
  it('輸入關鍵詞後點搜尋觸發 search 事件', async () => {
    const wrapper = mount(SearchForm);

    const input = wrapper.find('input[type="text"]');
    await input.setValue('測試關鍵詞');

    const button = wrapper.find('button.search-btn');
    await button.trigger('click');

    expect(wrapper.emitted('search')).toBeTruthy();
    expect(wrapper.emitted('search')[0][0]).toEqual({
      keyword: '測試關鍵詞',
    });
  });

  it('按回車也能觸發搜尋', async () => {
    const wrapper = mount(SearchForm);
    const input = wrapper.find('input[type="text"]');

    await input.setValue('關鍵詞');
    await input.trigger('keyup.enter');

    expect(wrapper.emitted('search')).toHaveLength(1);
  });

  it('點重置清空表單並觸發 reset 事件', async () => {
    const wrapper = mount(SearchForm);

    // 先輸入一些值
    await wrapper.find('input').setValue('測試');

    // 點重置
    await wrapper.find('button.reset-btn').trigger('click');

    expect(wrapper.find('input').element.value).toBe('');
    expect(wrapper.emitted('reset')).toHaveLength(1);
  });
});
```

## 測試非同步資料元件

```typescript
// __tests__/UserList.test.ts
import { mount, flushPromises } from '@vue/test-utils';
import UserList from '@/views/UserList.vue';

// Mock API
jest.mock('@/api/user', () => ({
  getUserList: jest.fn(),
}));

import { getUserList } from '@/api/user';

describe('UserList', () => {
  const mockUsers = [
    { id: 1, name: '張三', role: 'admin' },
    { id: 2, name: '李四', role: 'user' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserList as jest.Mock).mockResolvedValue({
      list: mockUsers,
      total: 2,
    });
  });

  it('載入時顯示 loading', () => {
    // 讓請求不返回
    (getUserList as jest.Mock).mockReturnValue(new Promise(() => {}));

    const wrapper = mount(UserList);
    expect(wrapper.find('.loading').exists()).toBe(true);
  });

  it('請求成功後渲染使用者列表', async () => {
    const wrapper = mount(UserList);

    await flushPromises();

    const rows = wrapper.findAll('.user-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('張三');
    expect(rows[1].text()).toContain('李四');
  });

  it('請求失敗顯示錯誤資訊', async () => {
    (getUserList as jest.Mock).mockRejectedValue(new Error('網路錯誤'));

    const wrapper = mount(UserList);
    await flushPromises();

    expect(wrapper.find('.error-message').exists()).toBe(true);
    expect(wrapper.find('.error-message').text()).toContain('載入失敗');
  });

  it('點選重新整理重新請求', async () => {
    const wrapper = mount(UserList);
    await flushPromises();

    await wrapper.find('.refresh-btn').trigger('click');
    await flushPromises();

    expect(getUserList).toHaveBeenCalledTimes(2);
  });
});
```

## 測試 Vuex 整合

```typescript
import { mount, createLocalVue } from '@vue/test-utils';
import Vuex from 'vuex';
import UserCard from '@/components/UserCard.vue';

const localVue = createLocalVue();
localVue.use(Vuex);

describe('UserCard 與 Vuex', () => {
  let store;
  let actions;
  let state;

  beforeEach(() => {
    state = {
      user: { id: 1, name: '張三', avatar: '/avatar.png' },
    };
    actions = {
      logout: jest.fn(),
    };
    store = new Vuex.Store({ state, actions });
  });

  it('顯示使用者資訊', () => {
    const wrapper = mount(UserCard, { store, localVue });
    expect(wrapper.text()).toContain('張三');
    expect(wrapper.find('img').attributes('src')).toBe('/avatar.png');
  });

  it('點退出呼叫 logout action', async () => {
    const wrapper = mount(UserCard, { store, localVue });
    await wrapper.find('.logout-btn').trigger('click');
    expect(actions.logout).toHaveBeenCalled();
  });
});
```

## 測試技巧

```typescript
// 1. 測試雙向繫結 v-model
it('支援 v-model', async () => {
  const wrapper = mount(MyInput, {
    propsData: { value: '初始值' },
  });

  await wrapper.find('input').setValue('新值');
  expect(wrapper.emitted('input')[0][0]).toBe('新值');
});

// 2. 測試 ref 訪問
it('通過 ref 呼叫元件方法', () => {
  const wrapper = mount(MyForm);
  const form = wrapper.vm as any;
  form.validate();
  // 驗證 validate 被呼叫的效果
});

// 3. 定時器 Mock
jest.useFakeTimers();

it('防抖後才觸發搜尋', async () => {
  const wrapper = mount(SearchInput);
  await wrapper.find('input').setValue('a');
  await wrapper.find('input').setValue('ab');

  expect(wrapper.emitted('search')).toBeFalsy();

  jest.advanceTimersByTime(500);

  expect(wrapper.emitted('search')).toHaveLength(1);
  expect(wrapper.emitted('search')[0][0]).toBe('ab');
});
```

## 小結

- Vue 元件測試用 `@vue/test-utils`，和 Jest 配合很好
- 測試行為（渲染、事件、互動），不要測試實現細節
- 非同步元件用 `flushPromises()` 等待更新
- Mock API 和定時器，讓測試結果確定可控
- 不需要 100% 覆蓋，核心互動和邊界情況優先
