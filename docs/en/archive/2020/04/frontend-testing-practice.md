---
title: "Frontend Automated Testing Practice Guide"
date: 2020-04-16 10:21:07
tags:
  - Testing
readingTime: 2
description: "项目迭代越来越快，回归测试却全靠人肉点。终于下决心把自动化测试搞起来，先从最实用的部分开始。"
---

项目迭代越来越快，回归测试却全靠人肉点。终于下决心把自动化测试搞起来，先从最实用的部分开始。

## Testing Pyramid

```
        /  E2E 测试  \        少量：验证核心流程
       / 集成测试     \       适量：验证模块协作
      / 单元测试       \      大量：验证逻辑正确
```

- **单元测试**：函数、组件的独立测试，快、稳
- **集成测试**：多个模块组合测试，验证交互
- **E2E 测试**：模拟真实用户操作，最慢但最真实

## Tool Selection

```bash
# Jest：测试框架 + 断言 + Mock
npm install -D jest @types/jest ts-jest

# Vue 组件测试
npm install -D @vue/test-utils vue-jest

# E2E 测试
npm install -D cypress
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
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,vue}',
    '!src/main.ts',
  ],
};
```

## Unit Testing: Utility Functions

```typescript
// utils/format.ts
export function formatCurrency(amount: number, currency = 'CNY'): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '--';
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 11) return phone;
  return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
}
```

```typescript
// __tests__/format.test.ts
import { formatCurrency, formatPhone } from '@/utils/format';

describe('formatCurrency', () => {
  it('应该正确格式化人民币', () => {
    expect(formatCurrency(1234.5)).toContain('1,234.50');
  });

  it('非数字应该返回 --', () => {
    expect(formatCurrency(NaN)).toBe('--');
    expect(formatCurrency(undefined as any)).toBe('--');
  });

  it('支持不同货币', () => {
    const result = formatCurrency(100, 'USD');
    expect(result).toContain('100.00');
  });
});

describe('formatPhone', () => {
  it('应该格式化 11 位手机号', () => {
    expect(formatPhone('13812345678')).toBe('138 1234 5678');
  });

  it('非 11 位应该原样返回', () => {
    expect(formatPhone('123')).toBe('123');
  });

  it('应该清理非数字字符', () => {
    expect(formatPhone('138-1234-5678')).toBe('138 1234 5678');
  });
});
```

## 组件测试

```typescript
// __tests__/Button.test.ts
import { mount } from '@vue/test-utils';
import Button from '@/components/Button.vue';

describe('Button', () => {
  it('渲染插槽内容', () => {
    const wrapper = mount(Button, {
      slots: { default: '提交' },
    });
    expect(wrapper.text()).toContain('提交');
  });

  it('点击时触发 click 事件', async () => {
    const wrapper = mount(Button);
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('disabled 状态不触发事件', async () => {
    const wrapper = mount(Button, {
      propsData: { disabled: true },
    });
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });

  it('loading 状态显示加载图标', () => {
    const wrapper = mount(Button, {
      propsData: { loading: true },
    });
    expect(wrapper.find('.loading-icon').exists()).toBe(true);
    expect(wrapper.attributes('disabled')).toBeDefined();
  });
});
```

## Mock API 请求

```typescript
// __tests__/UserList.test.ts
import { mount } from '@vue/test-utils';
import UserList from '@/views/UserList.vue';

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
}));

import axios from 'axios';

describe('UserList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('加载用户列表', async () => {
    const mockUsers = [
      { id: 1, name: '张三' },
      { id: 2, name: '李四' },
    ];
    (axios.get as jest.Mock).mockResolvedValue({
      data: { list: mockUsers, total: 2 },
    });

    const wrapper = mount(UserList);

    // 等待异步渲染
    await wrapper.vm.$nextTick();
    await new Promise(r => setTimeout(r, 0));

    const rows = wrapper.findAll('.user-row');
    expect(rows).toHaveLength(2);
    expect(rows.at(0).text()).toContain('张三');
  });

  it('请求失败显示错误提示', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('网络错误'));

    const wrapper = mount(UserList);
    await wrapper.vm.$nextTick();
    await new Promise(r => setTimeout(r, 0));

    expect(wrapper.find('.error-message').text()).toContain('加载失败');
  });
});
```

## Cypress E2E 测试

```javascript
// cypress/integration/login.spec.js
describe('登录流程', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('正确账号密码登录成功', () => {
    cy.get('[data-testid="username"]').type('admin');
    cy.get('[data-testid="password"]').type('123456');
    cy.get('[data-testid="login-btn"]').click();

    cy.url().should('include', '/dashboard');
    cy.get('.user-name').should('contain', 'admin');
  });

  it('错误密码提示错误', () => {
    cy.get('[data-testid="username"]').type('admin');
    cy.get('[data-testid="password"]').type('wrong');
    cy.get('[data-testid="login-btn"]').click();

    cy.get('.ant-message-error').should('be.visible');
    cy.url().should('include', '/login');
  });
});
```

## package.json 配置

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "cypress open",
    "test:e2e:ci": "cypress run"
  }
}
```

## Summary

- 先从工具函数的单元测试开始，投入产出比最高
- 组件测试关注行为（事件、渲染）而不是实现细节
- Mock 外部依赖（API、定时器），让测试结果可预测
- E2E 测试覆盖核心流程（登录、下单），不需要覆盖所有页面
- 测试覆盖率达到 60-70% 就已经很好了，不需要追求 100%
