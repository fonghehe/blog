---
title: "Vueプロジェクトの国際化 vue-i18n"
date: 2020-02-18 10:20:42
tags:
  - Vue
readingTime: 3
description: "国際化（i18n）はテキストの翻訳だけではありません。日付フォーマット・数字フォーマット・複数形のルール・テキストの方向（RTL）など、これらすべてに完全なソリューションが必要です。vue-i18nはVueエコシステムで最も成熟したi18nライブラリです。"
wordCount: 401
---

国際化（i18n）はテキストの翻訳だけではありません。日付フォーマット・数字フォーマット・複数形のルール・テキストの方向（RTL）など、これらすべてに完全なソリューションが必要です。vue-i18nはVueエコシステムで最も成熟したi18nライブラリです。

## 基本的な統合

vue-i18nのインストールと初期化：

```javascript
// i18n/index.js
import { createI18n } from "vue-i18n";
import zhCN from "./locales/zh-CN";
import enUS from "./locales/en-US";

const i18n = createI18n({
  legacy: false, // Composition APIモードを有効化
  locale: "ja-JP", // デフォルトのロケール
  fallbackLocale: "en-US", // フォールバックロケール
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});

export default i18n;

// main.js
import { createApp } from "vue";
import App from "./App.vue";
import i18n from "./i18n";

const app = createApp(App);
app.use(i18n);
app.mount("#app");
```

## 翻訳ファイルの構造

機能モジュールごとに翻訳ファイルを整理し、単一ファイルが肥大化しないようにします：

```javascript
// i18n/locales/en-US.js
export default {
  common: {
    confirm: "Confirm",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    search: "Search",
    loading: "Loading...",
    noData: "No data",
  },
  user: {
    profile: "Profile",
    settings: "Settings",
    logout: "Logout",
    welcomeBack: "Welcome back, {name}",
    unreadMessages: "{count} unread messages",
  },
  validation: {
    required: "{field} is required",
    minLength: "{field} must be at least {min} characters",
    maxLength: "{field} must be at most {max} characters",
    email: "Please enter a valid email address",
  },
};
```

## Composition APIの使い方

`<script>`内で`useI18n`フックを使用します：

```vue
{% raw %}
<template>
  <div class="user-page">
    <!-- 基本的な翻訳 -->
    <h1>{{ t("user.profile") }}</h1>

    <!-- パラメーター付きの翻訳 -->
    <p>{{ t("user.welcomeBack", { name: username }) }}</p>

    <!-- 複数形の処理 -->
    <p>{{ t("user.unreadMessages", { count: messageCount }) }}</p>

    <!-- 言語切り替え -->
    <select v-model="locale">
      <option value="zh-CN">中文</option>
      <option value="en-US">English</option>
    </select>

    <button @click="logout">{{ t("user.logout") }}</button>
  </div>
</template>

<script>
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { t, locale, d, n } = useI18n();

const username = ref("田中太郎");
const messageCount = ref(5);

const logout = () => {
  // ログアウトロジック
};
</script>
{% endraw %}
```

## 日付と数字のフォーマット

vue-i18nはロケールに基づいた日付と数字のフォーマットをサポートし、ローカライズの差異を統一的に処理します：

```javascript
// i18n/index.js
const i18n = createI18n({
  legacy: false,
  locale: "ja-JP",
  fallbackLocale: "en-US",
  messages: { "zh-CN": zhCN, "en-US": enUS },

  // 日付フォーマットのプリセット
  datetimeFormats: {
    "zh-CN": {
      short: { year: "numeric", month: "2-digit", day: "2-digit" },
      long: {
        year: "numeric",
        month: "long",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      },
    },
    "en-US": {
      short: { year: "numeric", month: "short", day: "numeric" },
      long: {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    },
  },

  // 数字フォーマットのプリセット
  numberFormats: {
    "zh-CN": {
      currency: { style: "currency", currency: "CNY" },
      percent: { style: "percent", minimumFractionDigits: 2 },
    },
    "en-US": {
      currency: { style: "currency", currency: "USD" },
      percent: { style: "percent", minimumFractionDigits: 2 },
    },
  },
});
```

```vue
{% raw %}
<template>
  <div>
    <!-- 日付フォーマット -->
    <p>短い日付: {{ d(new Date(), "short") }}</p>
    <p>長い日付: {{ d(new Date(), "long") }}</p>

    <!-- 数字フォーマット -->
    <p>価格: {{ n(9999, "currency") }}</p>
    <p>比率: {{ n(0.856, "percent") }}</p>
  </div>
</template>

<script>
import { useI18n } from "vue-i18n";
const { t, d, n } = useI18n();
</script>
{% endraw %}
```

## 言語パックの遅延ロード

大型プロジェクトでは翻訳ファイルが大きくなる可能性があります。ロケールごとに遅延ロードすることを推奨します：

```javascript
// i18n/index.js
import { createI18n } from "vue-i18n";

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem("locale") || "ja-JP",
  fallbackLocale: "en-US",
  messages: {}, // 最初は空
});

// 動的に言語パックをロード
const loadedLanguages = [];

async function loadLocaleMessages(locale) {
  if (loadedLanguages.includes(locale)) {
    i18n.global.locale.value = locale;
    return;
  }

  const messages = await import(
    /* webpackChunkName: "locale-[request]" */
    `./locales/${locale}.js`
  );

  i18n.global.setLocaleMessage(locale, messages.default);
  loadedLanguages.push(locale);
  i18n.global.locale.value = locale;
}

export { i18n, loadLocaleMessages };

// 言語切り替え時に呼び出す：
// await loadLocaleMessages('en-US')
// localStorage.setItem('locale', 'en-US')
```

## まとめ

- Composition APIでのvue-i18n：`useI18n()`で`t`、`d`、`n`を取得
- 翻訳をモジュールごとに整理してファイルを管理しやすくする
- `datetimeFormats`と`numberFormats`を設定してロケール対応のフォーマットを実現
- 大型プロジェクトでは言語パックを遅延ロードして初期ロードを削減
