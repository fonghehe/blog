---
title: "Vue 3 專案国際化方案：vue-i18n v9 遷移指南"
date: 2020-02-18 10:20:42
tags:
  - Vue
readingTime: 2
description: "國際化（i18n）不隻是翻譯文本那麼簡單。日期格式、數字格式、複數規則、文本方向（RTL），這些都需要一套完整的解決方案。vue-i18n 是 Vue 生態中最成熟的國際化庫，配合 Composition API 可以做到優雅且型別安全的多語言支援。"
wordCount: 280
---

國際化（i18n）不隻是翻譯文本那麼簡單。日期格式、數字格式、複數規則、文本方向（RTL），這些都需要一套完整的解決方案。vue-i18n 是 Vue 生態中最成熟的國際化庫，配合 Composition API 可以做到優雅且型別安全的多語言支援。

## 基礎整合

安裝和初始化 vue-i18n。

```javascript
// i18n/index.js
import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

const i18n = createI18n({
  legacy: false,           // 啟用 Composition API 模式
  locale: 'zh-CN',         // 預設語言
  fallbackLocale: 'en-US', // 回退語言
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

## 翻譯檔案結構

按功能模組組織翻譯檔案，避免單檔案過大。

```javascript
// i18n/locales/zh-CN.js
export default {
  common: {
    confirm: '確定',
    cancel: '取消',
    save: '儲存',
    delete: '刪除',
    search: '搜尋',
    loading: '載入中...',
    noData: '暫無資料'
  },
  user: {
    profile: '個人資料',
    settings: '設定',
    logout: '退出登入',
    welcomeBack: '歡迎回來，{name}',
    unreadMessages: '{count} 條未讀訊息'
  },
  validation: {
    required: '{field}不能為空',
    minLength: '{field}最少{min}個字元',
    maxLength: '{field}最多{max}個字元',
    email: '請輸入有效的郵箱地址'
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

## Composition API 用法

在 `<script>` 中使用 `useI18n` 鉤子。

```vue
{% raw %}
<template>
  <div class="user-page">
    <!-- 基礎翻譯 -->
    <h1>{{ t('user.profile') }}</h1>

    <!-- 帶引數的翻譯 -->
    <p>{{ t('user.welcomeBack', { name: username }) }}</p>

    <!-- 複數處理 -->
    <p>{{ t('user.unreadMessages', { count: messageCount }) }}</p>

    <!-- 語言切換 -->
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

const username = ref('張三')
const messageCount = ref(5)

const logout = () => {
  // 退出邏輯
}
</script>
{% endraw %}
```

## 日期和數字格式化

vue-i18n 支援基於 locale 的日期和數字格式化，統一處理本地化差異。

```javascript
// i18n/index.js
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: { 'zh-CN': zhCN, 'en-US': enUS },

  // 日期格式化預設
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

  // 數字格式化預設
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
    <p>長日期: {{ d(new Date(), 'long') }}</p>

    <!-- 數字格式化 -->
    <p>價格: {{ n(9999, 'currency') }}</p>
    <p>比例: {{ n(0.856, 'percent') }}</p>
  </div>
</template>

<script>
import { useI18n } from 'vue-i18n'
const { t, d, n } = useI18n()
</script>
{% endraw %}
```

## 按需載入語言包

大型專案的翻譯檔案可能很大，推薦按語言懶載入。

```javascript
// i18n/index.js
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {} // 初始為空
})

// 動態載入語言包
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

// 切換語言時呼叫
// await loadLocaleMessages('en-US')
// localStorage.setItem('locale', 'en-US')
```

## 小結

- `legacy: false` 啟用 Composition API 模式，用 `useI18n()` 獲取 `t`、`d`、`n` 方法
- 翻譯檔案按功能模組組織，避免單檔案膨脹
- `d()` 和 `n()` 分別處理日期和數字的本地化格式化
- 按需載入語言包，減少首屏 bundle 體積
- 語言切換後記得同步 `localStorage`，保持使用者偏好
