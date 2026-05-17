---
title: "Vueのトランジションとアニメーション実践"
date: 2018-06-21 10:55:46
tags:
  - Vue
readingTime: 2
description: "Vueの`<transition>`コンポーネントはアニメーションの追加をシンプルにしてくれます。よく使うシナリオを記録します。"
---

Vueの`<transition>`コンポーネントはアニメーションの追加をシンプルにしてくれます。よく使うシナリオを記録します。

## 基本的な使い方

アニメーションを追加したい要素を`<transition>`で包むと、VueはEnter/Leave時に自動的にクラスを追加します：

```html
<transition name="fade">
  <p v-if="show">Hello</p>
</transition>
```

```css
/* EnterとLeaveの最終状態 */
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

/* Enterの初期状態 / Leaveの最終状態 */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* トランジションアニメーションの設定 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
```

Vue 2のクラス名は少し異なります：`v-enter`（`v-enter-from`ではない）。Vue 3で命名が統一されました。

```css
/* Vue 2の書き方 */
.fade-enter {
  opacity: 0;
}
.fade-leave-to {
  opacity: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
```

## よく使うアニメーション効果

```css
/* スライドイン */
.slide-enter {
  transform: translateY(-20px);
  opacity: 0;
}
.slide-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

/* スケール */
.scale-enter {
  transform: scale(0.9);
  opacity: 0;
}
.scale-leave-to {
  transform: scale(0.9);
  opacity: 0;
}
.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}
```

## リストのトランジション

`<transition-group>`でリストにアニメーションを追加します：

```html
{% raw %}
<transition-group name="list" tag="ul">
  <li v-for="item in items" :key="item.id">{{ item.name }}</li>
</transition-group>
{% endraw %}
```

```css
.list-enter {
  opacity: 0;
  transform: translateX(-30px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.list-enter-active,
.list-leave-active {
  transition: all 0.3s;
}

/* 他のアイテムの移動アニメーション */
.list-move {
  transition: transform 0.3s;
}
```

## サードパーティアニメーションライブラリAnimate.cssとの組み合わせ

```html
<transition
  enter-active-class="animated fadeInDown"
  leave-active-class="animated fadeOutUp"
>
  <div v-if="show">コンテンツ</div>
</transition>
```

## ルート切り替えアニメーション

```html
<!-- App.vue -->
<transition name="page" mode="out-in">
  <router-view :key="$route.path" />
</transition>
```

```css
.page-enter {
  opacity: 0;
  transform: translateX(20px);
}
.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
.page-enter-active,
.page-leave-active {
  transition: all 0.25s ease;
}
```

`mode="out-in"`で古いページが退場してから新しいページが登場するようになり、2つのページが同時に表示されることを防ぎます。

## JavaScriptフック

細かい制御が必要な場合はJSフックを使います（GSAPなどのライブラリと組み合わせる）：

```html
<transition @enter="onEnter" @leave="onLeave" :css="false">
  <div v-if="show">コンテンツ</div>
</transition>
```

```javascript
methods: {
  onEnter(el, done) {
    // elは登場するDOM要素；完了したらdone()を呼ぶ
    gsap.from(el, { duration: 0.4, opacity: 0, y: -20, onComplete: done })
  },
  onLeave(el, done) {
    gsap.to(el, { duration: 0.3, opacity: 0, y: 20, onComplete: done })
  }
}
```

## まとめ

- `<transition name="xxx">` + CSSクラスが最もシンプルな方法
- `<transition-group>`でリストを扱う。`:key`と`.xxx-move`を忘れずに
- `mode="out-in"`で新旧ページの重なりを防ぐ
- 複雑なアニメーションにはJSフック + GSAPを使う
