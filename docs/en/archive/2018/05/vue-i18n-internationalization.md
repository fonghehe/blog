---
title: "Vue 2 i18n with vue-i18n: vue-i18n Getting StartedPractice"
date: 2020-02-18 10:20:42
tags:
  - Vue
readingTime: 2
description: "Internationalization (i18n) is more than just translating text. Date formats, number formats, pluralization rules, text direction (RTL) — all of these require a"
wordCount: 135
---

Internationalization (i18n) is more than just translating text. Date formats, number formats, pluralization rules, text direction (RTL) — all of these require a complete solution. vue-i18n is the most mature i18n library in the Vue ecosystem.

## Basic Integration

Install and initialize vue-i18n:

```javascript
// i18n/index.js
import { createI18n } from "vue-i18n";
import zhCN from "./locales/zh-CN";
import enUS from "./locales/en-US";

const i18n = createI18n({
  legacy: false, // Enable Composition API mode
  locale: "zh-CN", // Default locale
  fallbackLocale: "en-US", // Fallback locale
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

## Translation File Structure

Organise translation files by feature module to keep individual files manageable:

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

## Composition API Usage

Use the `useI18n` hook in `<script>`:

```vue
{% raw %}
<template>
  <div class="user-page">
    <!-- Basic translation -->
    <h1>{{ t("user.profile") }}</h1>

    <!-- Translation with parameters -->
    <p>{{ t("user.welcomeBack", { name: username }) }}</p>

    <!-- Plural handling -->
    <p>{{ t("user.unreadMessages", { count: messageCount }) }}</p>

    <!-- Language switcher -->
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

const username = ref("Alice");
const messageCount = ref(5);

const logout = () => {
  // logout logic
};
</script>
{% endraw %}
```

## Date and Number Formatting

vue-i18n supports locale-based date and number formatting to handle localisation differences uniformly:

```javascript
// i18n/index.js
const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "en-US",
  messages: { "zh-CN": zhCN, "en-US": enUS },

  // Date format presets
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

  // Number format presets
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
    <!-- Date formatting -->
    <p>Short date: {{ d(new Date(), "short") }}</p>
    <p>Long date: {{ d(new Date(), "long") }}</p>

    <!-- Number formatting -->
    <p>Price: {{ n(9999, "currency") }}</p>
    <p>Ratio: {{ n(0.856, "percent") }}</p>
  </div>
</template>

<script>
import { useI18n } from "vue-i18n";
const { t, d, n } = useI18n();
</script>
{% endraw %}
```

## Lazy Loading Locale Bundles

Translation files can be large in big projects — lazy-load them per locale:

```javascript
// i18n/index.js
import { createI18n } from "vue-i18n";

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem("locale") || "en-US",
  fallbackLocale: "en-US",
  messages: {}, // initially empty
});

// Dynamically load a locale bundle
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

// Call when switching language:
// await loadLocaleMessages('en-US')
// localStorage.setItem('locale', 'en-US')
```

## Summary

- vue-i18n with Composition API: use `useI18n()` to get `t`, `d`, `n`
- Organise translations by module to keep files manageable
- Configure `datetimeFormats` and `numberFormats` for locale-aware formatting
- Lazy-load locale bundles in large projects to reduce initial load
