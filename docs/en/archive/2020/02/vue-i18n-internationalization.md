---
title: "Vue 3 i18n with vue-i18n: v9 Migration Guide"
date: 2020-02-18 10:20:42
tags:
  - Vue
readingTime: 2
description: "Internationalization (i18n) is more than just translating text—date formats, number formats, pluralization rules, and RTL direction all require a complete solution. vue-i18n is the most mature i18n library in the Vue ecosystem, and paired with the Composition API it delivers elegant, type-safe multilingual support."
wordCount: 180
---

Internationalization (i18n) is more than just translating text. Date formats, number formats, pluralization rules, and text direction (RTL) all call for a complete solution. vue-i18n is the most mature i18n library in the Vue ecosystem, and paired with the Composition API it delivers elegant, type-safe multi-language support.

## Basic Integration

Install and initialize vue-i18n.

```javascript
// i18n/index.js
import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

const i18n = createI18n({
  legacy: false,           // 启用 Composition API 模式
  locale: 'zh-CN',         // 默认语言
  fallbackLocale: 'en-US', // 回退语言
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export default i18n

// main.js
import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'

const app = createApp(App)
app.use(i18n)
app.mount('#app')
```

## Translation File Structure

Organize translation files by feature module to keep any single file from getting too large.

```javascript
// i18n/locales/zh-CN.js
export default {
  common: {
    confirm: '确定',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    search: '搜索',
    loading: '加载中...',
    noData: '暂无数据'
  },
  user: {
    profile: '个人资料',
    settings: '设置',
    logout: '退出登录',
    welcomeBack: '欢迎回来，{name}',
    unreadMessages: '{count} 条未读消息'
  },
  validation: {
    required: '{field}不能为空',
    minLength: '{field}最少{min}个字符',
    maxLength: '{field}最多{max}个字符',
    email: '请输入有效的邮箱地址'
  }
}
```

```javascript
// i18n/locales/en-US.js
export default {
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    search: 'Search',
    loading: 'Loading...',
    noData: 'No data'
  },
  user: {
    profile: 'Profile',
    settings: 'Settings',
    logout: 'Logout',
    welcomeBack: 'Welcome back, {name}',
    unreadMessages: '{count} unread messages'
  },
  validation: {
    required: '{field} is required',
    minLength: '{field} must be at least {min} characters',
    maxLength: '{field} must be at most {max} characters',
    email: 'Please enter a valid email address'
  }
}
```

## Composition API Usage

Use the `useI18n` hook inside `<script>`.

```vue
{% raw %}
<template>
  <div class="user-page">
    <!-- 基础翻译 -->
    <h1>{{ t('user.profile') }}</h1>

    <!-- 带参数的翻译 -->
    <p>{{ t('user.welcomeBack', { name: username }) }}</p>

    <!-- 复数处理 -->
    <p>{{ t('user.unreadMessages', { count: messageCount }) }}</p>

    <!-- 语言切换 -->
    <select v-model="locale">
      <option value="zh-CN">中文</option>
      <option value="en-US">English</option>
    </select>

    <button @click="logout">{{ t('user.logout') }}</button>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale, d, n } = useI18n()

const username = ref('张三')
const messageCount = ref(5)

const logout = () => {
  // 退出逻辑
}
</script>
{% endraw %}
```

## Date and Number Formatting

vue-i18n supports locale-based date and number formatting, handling localization differences in one place.

```javascript
// i18n/index.js
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: { 'zh-CN': zhCN, 'en-US': enUS },

  // 日期格式化预设
  datetimeFormats: {
    'zh-CN': {
      short: { year: 'numeric', month: '2-digit', day: '2-digit' },
      long: {
        year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }
    },
    'en-US': {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }
    }
  },

  // 数字格式化预设
  numberFormats: {
    'zh-CN': {
      currency: { style: 'currency', currency: 'CNY' },
      percent: { style: 'percent', minimumFractionDigits: 2 }
    },
    'en-US': {
      currency: { style: 'currency', currency: 'USD' },
      percent: { style: 'percent', minimumFractionDigits: 2 }
    }
  }
})
```

```vue
{% raw %}
<template>
  <div>
    <!-- 日期格式化 -->
    <p>短日期: {{ d(new Date(), 'short') }}</p>
    <p>长日期: {{ d(new Date(), 'long') }}</p>

    <!-- 数字格式化 -->
    <p>价格: {{ n(9999, 'currency') }}</p>
    <p>比例: {{ n(0.856, 'percent') }}</p>
  </div>
</template>

<script>
import { useI18n } from 'vue-i18n'
const { t, d, n } = useI18n()
</script>
{% endraw %}
```

## Loading Locale Bundles on Demand

In large projects the translation files can get big, so it's worth lazy-loading them per language.

```javascript
// i18n/index.js
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {} // 初始为空
})

// 动态加载语言包
const loadedLanguages = []

async function loadLocaleMessages(locale) {
  if (loadedLanguages.includes(locale)) {
    i18n.global.locale.value = locale
    return
  }

  const messages = await import(
    /* webpackChunkName: "locale-[request]" */
    `./locales/${locale}.js`
  )

  i18n.global.setLocaleMessage(locale, messages.default)
  loadedLanguages.push(locale)
  i18n.global.locale.value = locale
}

export { i18n, loadLocaleMessages }

// 切换语言时调用
// await loadLocaleMessages('en-US')
// localStorage.setItem('locale', 'en-US')
```

## Summary

- `legacy: false` enables the Composition API mode; use `useI18n()` to get the `t`, `d`, and `n` methods
- Organize translation files by feature module to avoid a single bloated file
- `d()` and `n()` handle locale-aware formatting for dates and numbers respectively
- Lazy-load locale bundles to shrink the initial bundle size
- After switching languages, remember to sync `localStorage` to preserve the user's preference
