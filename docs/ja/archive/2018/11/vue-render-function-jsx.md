---
title: "Vue render 関数と JSX"
date: 2018-11-20 11:14:48
tags:
  - Vue
readingTime: 2
description: "ほとんどの場合テンプレートで十分ですが、render 関数がより柔軟な場面があります。"
wordCount: 374
---

ほとんどの場合テンプレートで十分ですが、render 関数がより柔軟な場面があります。

## render 関数が必要な理由

テンプレートには限界があります—props に応じて動的に異なるタグを生成できません：

```javascript
// ❌ テンプレートではできない（prop に応じて動的にタグ名を指定できない）
// <component :is="level">  // 使えるが、タグ名のロジックが複雑になると面倒

// ✅ render 関数なら完全に JS で制御
export default {
  props: {
    level: { type: Number, required: true },
  },
  render(h) {
    return h("h" + this.level, this.$slots.default);
  },
};
// <Heading :level="2">見出し</Heading> → <h2>見出し</h2>
```

## createElement（h）のパラメータ

```javascript
h(
  // 1. タグ名、コンポーネントオプションオブジェクト、または非同期関数
  "div",

  // 2. データオブジェクト（オプション）
  {
    class: { active: true, disabled: false },
    style: { color: "red", fontSize: "14px" },
    attrs: { id: "app", "data-id": "123" },
    props: { value: "hello" },
    on: { click: this.handleClick },
    // ネイティブイベント（コンポーネント）
    nativeOn: { click: this.handleNativeClick },
  },

  // 3. 子ノード（オプション）
  ["text content", h("span", "child")],
);
```

## 実践：動的フォーム

設定に応じて異なるタイプのフォーム項目を生成：

```javascript
const FormField = {
  props: {
    type: String, // 'input' | 'select' | 'textarea'
    value: [String, Number],
    options: Array, // select の選択肢
  },
  render(h) {
    if (this.type === "select") {
      return h(
        "select",
        {
          on: { change: (e) => this.$emit("input", e.target.value) },
        },
        this.options.map((opt) =>
          h("option", { attrs: { value: opt.value } }, opt.label),
        ),
      );
    }

    if (this.type === "textarea") {
      return h("textarea", {
        attrs: { value: this.value },
        on: { input: (e) => this.$emit("input", e.target.value) },
      });
    }

    return h("input", {
      attrs: { type: this.type || "text", value: this.value },
      on: { input: (e) => this.$emit("input", e.target.value) },
    });
  },
};
```

## JSX：より読みやすい render 関数

Babel JSX プラグインを設定すると、h 呼び出しの代わりに JSX を使用できます：

```bash
npm install --save-dev @vue/babel-preset-jsx @vue/babel-helper-vue-jsx-merge-props
```

```javascript
// 上記と同等の JSX 記述
export default {
  props: { level: Number },
  render() {
    const Tag = `h${this.level}`
    return <Tag>{this.$slots.default}</Tag>
  }
}

// より複雑な例
export default {
  render() {
    return (
      <div class="container">
        <header>
          <h1>{this.title}</h1>
        </header>
        <ul>
          {this.items.map(item => (
            <li key={item.id} onClick={() => this.select(item)}>
              {item.name}
            </li>
          ))}
        </ul>
      </div>
    )
  }
}
```

## テンプレート vs render 関数の選択

- **テンプレート**：ほとんどの場面。直感的で読みやすく、ツールサポートが良い
- **render 関数**：完全な JS 能力が必要な場面（動的タグ、複雑なループロジック）
- **JSX**：React の開発スタイルに慣れている、またはコンポーネントが主にロジックで表示ではない場合

## まとめ

- `render` 関数は `h`（createElement）を受け取り、VNode を返す
- テンプレートは最終的にも render 関数にコンパイルされる
- JSX は render 関数のシンタックスシュガーで、Babel プラグインが必要
- まずテンプレートを使い、動的性が必要な時だけ render/JSX を使う
