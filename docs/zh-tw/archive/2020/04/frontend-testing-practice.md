---
title: "前端自動化測試實踐指南"
date: 2020-04-16 10:21:07
tags:
  - 測試
readingTime: 2
description: "專案迭代越來越快，迴歸測試卻全靠人肉點。終於下決心把自動化測試搞起來，先從最實用的部分開始。"
---

專案迭代越來越快，迴歸測試卻全靠人肉點。終於下決心把自動化測試搞起來，先從最實用的部分開始。

## 測試金字塔

```
        /  E2E 測試  \        少量：驗證核心流程
       / 整合測試     \       適量：驗證模組協作
      / 單元測試       \      大量：驗證邏輯正確
```

- **單元測試**：函式、元件的獨立測試，快、穩
- **整合測試**：多個模組組合測試，驗證互動
- **E2E 測試**：模擬真實使用者操作，最慢但最真實

## 工具選型

```bash
# Jest：測試框架 + 斷言 + Mock
npm install -D jest @types/jest ts-jest

# Vue 元件測試
npm install -D @vue/test-utils vue-jest

# E2E 測試
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

## 單元測試：工具函式

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
  it('應該正確格式化人民幣', () => {
    expect(formatCurrency(1234.5)).toContain('1,234.50');
  });

  it('非數字應該返回 --', () => {
    expect(formatCurrency(NaN)).toBe('--');
    expect(formatCurrency(undefined as any)).toBe('--');
  });

  it('支援不同貨幣', () => {
    const result = formatCurrency(100, 'USD');
    expect(result).toContain('100.00');
  });
});

describe('formatPhone', () => {
  it('應該格式化 11 位手機號', () => {
    expect(formatPhone('13812345678')).toBe('138 1234 5678');
  });

  it('非 11 位應該原樣返回', () => {
    expect(formatPhone('123')).toBe('123');
  });

  it('應該清理非數字字元', () => {
    expect(formatPhone('138-1234-5678')).toBe('138 1234 5678');
  });
});
```

## 元件測試

```typescript
// __tests__/Button.test.ts
import { mount } from '@vue/test-utils';
import Button from '@/components/Button.vue';

describe('Button', () => {
  it('渲染插槽內容', () => {
    const wrapper = mount(Button, {
      slots: { default: '提交' },
    });
    expect(wrapper.text()).toContain('提交');
  });

  it('點選時觸發 click 事件', async () => {
    const wrapper = mount(Button);
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('disabled 狀態不觸發事件', async () => {
    const wrapper = mount(Button, {
      propsData: { disabled: true },
    });
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });

  it('loading 狀態顯示載入圖示', () => {
    const wrapper = mount(Button, {
      propsData: { loading: true },
    });
    expect(wrapper.find('.loading-icon').exists()).toBe(true);
    expect(wrapper.attributes('disabled')).toBeDefined();
  });
});
```

## Mock API 請求

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

  it('載入使用者列表', async () => {
    const mockUsers = [
      { id: 1, name: '張三' },
      { id: 2, name: '李四' },
    ];
    (axios.get as jest.Mock).mockResolvedValue({
      data: { list: mockUsers, total: 2 },
    });

    const wrapper = mount(UserList);

    // 等待非同步渲染
    await wrapper.vm.$nextTick();
    await new Promise(r => setTimeout(r, 0));

    const rows = wrapper.findAll('.user-row');
    expect(rows).toHaveLength(2);
    expect(rows.at(0).text()).toContain('張三');
  });

  it('請求失敗顯示錯誤提示', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('網路錯誤'));

    const wrapper = mount(UserList);
    await wrapper.vm.$nextTick();
    await new Promise(r => setTimeout(r, 0));

    expect(wrapper.find('.error-message').text()).toContain('載入失敗');
  });
});
```

## Cypress E2E 測試

```javascript
// cypress/integration/login.spec.js
describe('登入流程', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('正確賬號密碼登入成功', () => {
    cy.get('[data-testid="username"]').type('admin');
    cy.get('[data-testid="password"]').type('123456');
    cy.get('[data-testid="login-btn"]').click();

    cy.url().should('include', '/dashboard');
    cy.get('.user-name').should('contain', 'admin');
  });

  it('錯誤密碼提示錯誤', () => {
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

## 小結

- 先從工具函式的單元測試開始，投入產出比最高
- 元件測試關注行為（事件、渲染）而不是實現細節
- Mock 外部依賴（API、定時器），讓測試結果可預測
- E2E 測試覆蓋核心流程（登入、下單），不需要覆蓋所有頁面
- 測試覆蓋率達到 60-70% 就已經很好了，不需要追求 100%
