---
title: "Vue 3 项目国际化ソリューション：vue-i18n v9 移行ガイド"
date: 2020-02-18 10:20:42
tags:
  - Vue
readingTime: 3
description: "国際化（i18n）は単なるテキストの翻訳だけではありません。日付形式、数値形式、複数形ルール、テキスト方向（RTL）など、これらには完全なソリューションが必要です。vue-i18n は Vue エコシステムで最も成熟した国際化ライブラリであり、Composition API と組み合わせることで、エレガントで型安全な多言語サポートを実現できます。"
wordCount: 505
---

国際化（i18n）は単なるテキストの翻訳だけではありません。日付形式、数値形式、複数形ルール、テキスト方向（RTL）など、これらには完全なソリューションが必要です。vue-i18n は Vue エコシステムで最も成熟した国際化ライブラリであり、Composition API と組み合わせることで、エレガントで型安全な多言語サポートを実現できます。

## 基本統合

vue-i18n のインストールと初期化。

```javascript
// i18n/index.js
import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

const i18n = createI18n({
  legacy: false,           // Composition API モードを有効化
  locale: 'zh-CN',         // デフォルト言語
  fallbackLocale: 'en-US', // フォールバック言語
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

## 翻訳ファイルの構造

機能モジュールごとに翻訳ファイルを整理し、単一ファイルが大きくなりすぎないようにします。

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

## Composition API の使い方

`<script>` 内で `useI18n` フックを使用します。

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
  // ログアウト処理
}
</script>
{% endraw %}
```

## 日付と数字の書式設定

vue-i18n はロケールに基づいた日付と数字の書式設定をサポートしており、ローカライズの差異を統一して処理します。

```javascript
// i18n/index.js
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: { 'zh-CN': zhCN, 'en-US': enUS },

  // 日付書式のプリセット
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

  // 数値書式のプリセット
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

## 言語パックのオンデマンド読み込み

大規模プロジェクトでは翻訳ファイルが大きくなる可能性があるため、言語ごとに遅延読み込みすることをお勧めします。

```javascript
// i18n/index.js
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {} // 初期は空
})

// 言語パックを動的に読み込む
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

// 言語切り替え時に呼び出す
// await loadLocaleMessages('en-US')
// localStorage.setItem('locale', 'en-US')
```

## まとめ

- `legacy: false` で Composition API モードを有効にし、`useI18n()` で `t`、`d`、`n` メソッドを取得します
- 翻訳ファイルは機能モジュールごとに整理し、単一ファイルの肥大化を防ぎます
- `d()` と `n()` はそれぞれ日付と数字のローカライズ書式を処理します
- 言語パックをオンデマンドで読み込み、初回表示のバンドルサイズを削減します
- 言語切り替え後は `localStorage` を同期してユーザー設定を保持しましょう
