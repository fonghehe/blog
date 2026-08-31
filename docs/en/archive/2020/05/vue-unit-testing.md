---
title: "Vue Component Unit Testing in Practice"
date: 2020-05-28 16:10:29
tags:
  - Vue
readingTime: 3
description: "I wrote a testing practices guide earlier; this piece goes deeper specifically on unit testing Vue components. Our admin dashboard has 200+ components, and to ensure refactoring doesn't break anything, tests must keep up."
wordCount: 107
---

I wrote a testing practices guide earlier; this piece goes deeper specifically on unit testing for Vue components. Our admin dashboard project has 200+ components, and to make sure refactoring doesn't break things, the tests have to keep up.

## Environment Setup

```bash
npm install -D jest @vue/test-utils vue-jest babel-jest @babel/core @babel/preset-env

# Vue 2
npm install -D vue-template-compiler vue@2

# ts 支持
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
  // 覆盖率
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
```

## Testing Pure Presentational Components

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
  it('渲染插槽内容', () => {
    const wrapper = mount(Tag, {
      slots: { default: '标签内容' },
    });
    expect(wrapper.text()).toBe('标签内容');
  });

  it('默认类型是 default', () => {
    const wrapper = mount(Tag);
    expect(wrapper.classes()).toContain('tag--default');
  });

  it('设置 type 后有对应类名', () => {
    const wrapper = mount(Tag, {
      propsData: { type: 'success' },
    });
    expect(wrapper.classes()).toContain('tag--success');
  });

  it('点击时触发 click 事件', async () => {
    const wrapper = mount(Tag);
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('type 校验失败时在控制台警告', () => {
    const warnSpy = jest.spyOn(console, 'error').mockImplementation();
    mount(Tag, {
      propsData: { type: 'unknown' },
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
```

## Testing Form Components

```typescript
// __tests__/SearchForm.test.ts
import { mount } from '@vue/test-utils';
import SearchForm from '@/components/SearchForm.vue';

describe('SearchForm', () => {
  it('输入关键词后点搜索触发 search 事件', async () => {
    const wrapper = mount(SearchForm);

    const input = wrapper.find('input[type="text"]');
    await input.setValue('测试关键词');

    const button = wrapper.find('button.search-btn');
    await button.trigger('click');

    expect(wrapper.emitted('search')).toBeTruthy();
    expect(wrapper.emitted('search')[0][0]).toEqual({
      keyword: '测试关键词',
    });
  });

  it('按回车也能触发搜索', async () => {
    const wrapper = mount(SearchForm);
    const input = wrapper.find('input[type="text"]');

    await input.setValue('关键词');
    await input.trigger('keyup.enter');

    expect(wrapper.emitted('search')).toHaveLength(1);
  });

  it('点重置清空表单并触发 reset 事件', async () => {
    const wrapper = mount(SearchForm);

    // 先输入一些值
    await wrapper.find('input').setValue('测试');

    // 点重置
    await wrapper.find('button.reset-btn').trigger('click');

    expect(wrapper.find('input').element.value).toBe('');
    expect(wrapper.emitted('reset')).toHaveLength(1);
  });
});
```

## Testing Components with Async Data

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
    { id: 1, name: '张三', role: 'admin' },
    { id: 2, name: '李四', role: 'user' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserList as jest.Mock).mockResolvedValue({
      list: mockUsers,
      total: 2,
    });
  });

  it('加载时显示 loading', () => {
    // 让请求不返回
    (getUserList as jest.Mock).mockReturnValue(new Promise(() => {}));

    const wrapper = mount(UserList);
    expect(wrapper.find('.loading').exists()).toBe(true);
  });

  it('请求成功后渲染用户列表', async () => {
    const wrapper = mount(UserList);

    await flushPromises();

    const rows = wrapper.findAll('.user-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('张三');
    expect(rows[1].text()).toContain('李四');
  });

  it('请求失败显示错误信息', async () => {
    (getUserList as jest.Mock).mockRejectedValue(new Error('网络错误'));

    const wrapper = mount(UserList);
    await flushPromises();

    expect(wrapper.find('.error-message').exists()).toBe(true);
    expect(wrapper.find('.error-message').text()).toContain('加载失败');
  });

  it('点击刷新重新请求', async () => {
    const wrapper = mount(UserList);
    await flushPromises();

    await wrapper.find('.refresh-btn').trigger('click');
    await flushPromises();

    expect(getUserList).toHaveBeenCalledTimes(2);
  });
});
```

## Testing Vuex Integration

```typescript
import { mount, createLocalVue } from '@vue/test-utils';
import Vuex from 'vuex';
import UserCard from '@/components/UserCard.vue';

const localVue = createLocalVue();
localVue.use(Vuex);

describe('UserCard 与 Vuex', () => {
  let store;
  let actions;
  let state;

  beforeEach(() => {
    state = {
      user: { id: 1, name: '张三', avatar: '/avatar.png' },
    };
    actions = {
      logout: jest.fn(),
    };
    store = new Vuex.Store({ state, actions });
  });

  it('显示用户信息', () => {
    const wrapper = mount(UserCard, { store, localVue });
    expect(wrapper.text()).toContain('张三');
    expect(wrapper.find('img').attributes('src')).toBe('/avatar.png');
  });

  it('点退出调用 logout action', async () => {
    const wrapper = mount(UserCard, { store, localVue });
    await wrapper.find('.logout-btn').trigger('click');
    expect(actions.logout).toHaveBeenCalled();
  });
});
```

## Testing Tips

```typescript
// 1. 测试双向绑定 v-model
it('支持 v-model', async () => {
  const wrapper = mount(MyInput, {
    propsData: { value: '初始值' },
  });

  await wrapper.find('input').setValue('新值');
  expect(wrapper.emitted('input')[0][0]).toBe('新值');
});

// 2. 测试 ref 访问
it('通过 ref 调用组件方法', () => {
  const wrapper = mount(MyForm);
  const form = wrapper.vm as any;
  form.validate();
  // 验证 validate 被调用的效果
});

// 3. 定时器 Mock
jest.useFakeTimers();

it('防抖后才触发搜索', async () => {
  const wrapper = mount(SearchInput);
  await wrapper.find('input').setValue('a');
  await wrapper.find('input').setValue('ab');

  expect(wrapper.emitted('search')).toBeFalsy();

  jest.advanceTimersByTime(500);

  expect(wrapper.emitted('search')).toHaveLength(1);
  expect(wrapper.emitted('search')[0][0]).toBe('ab');
});
```

## Summary

- For Vue component testing, `@vue/test-utils` pairs well with Jest.
- Test behavior (rendering, events, interactions), not implementation details.
- For async components, use `flushPromises()` to wait for updates.
- Mock the API and timers so test results are deterministic and controllable.
- You don't need 100% coverage—prioritize core interactions and edge cases.
