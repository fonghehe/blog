---
title: "JavaScript エラーハンドリングのベストプラクティス"
date: 2018-12-08 11:24:51
tags:
  - JavaScript
readingTime: 2
description: "プロジェクトが本番でバグを起こしたとき、最も辛いのはバグがあることではなく、バグがどこにあるかわからないことです。適切なエラーハンドリングで問題の特定がずっと容易になります。"
---

プロジェクトが本番でバグを起こしたとき、最も辛いのはバグがあることではなく、バグがどこにあるかわからないことです。適切なエラーハンドリングで問題の特定がずっと容易になります。

## 同期エラー：try/catch

```javascript
// 基本的な使い方
try {
  JSON.parse("invalid json");
} catch (e) {
  console.error("JSON の解析に失敗:", e.message);
}

// finally：成功でも失敗でも必ず実行される
function readFile() {
  let file = null;
  try {
    file = openFile("data.json");
    return parseContent(file);
  } catch (e) {
    console.error("読み込み失敗:", e);
    throw e; // 再スロー。呼び出し元に失敗を伝える
  } finally {
    if (file) file.close(); // リソースが確実に解放される
  }
}
```

## 非同期エラーのハンドリング

```javascript
// Promise：.catch() でキャッチ
fetchUser(id)
  .then((user) => renderUser(user))
  .catch((e) => {
    console.error("ユーザー取得失敗:", e);
    showErrorMessage("読み込みに失敗しました。再試行してください");
  });

// async/await：try/catch を使用
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    return user;
  } catch (e) {
    if (e.status === 404) {
      return null; // ユーザーが存在しない場合は null を返す
    }
    throw e; // その他のエラーは上に伝播させる
  }
}
```

## カスタムエラークラス

```javascript
// 異なる種類のエラーを区別する
class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

// 使用例
async function createUser(data) {
  if (!data.email) {
    throw new ValidationError("メールアドレスは必須です", "email");
  }

  const res = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new ApiError(body.message, res.status, body.code);
  }

  return res.json();
}

// 呼び出し側で異なる種類のエラーを正確に処理できる
try {
  await createUser({ name: "山田太郎" });
} catch (e) {
  if (e instanceof ValidationError) {
    formErrors[e.field] = e.message; // フィールドエラーを表示
  } else if (e instanceof ApiError) {
    message.error(e.message); // API エラーを表示
  } else {
    message.error("不明なエラーが発生しました。ページを更新してください");
    Sentry.captureException(e); // 不明なエラーを上報
  }
}
```

## グローバルエラーのキャッチ

```javascript
// 処理されていない Promise の拒否をキャッチ
window.addEventListener("unhandledrejection", (event) => {
  console.error("処理されていない Promise の拒否:", event.reason);
  Sentry.captureException(event.reason);
  event.preventDefault(); // デフォルトのコンソール警告を抑制
});

// 同期エラーのキャッチ（ランタイムエラー）
window.addEventListener("error", (event) => {
  if (event.error) {
    Sentry.captureException(event.error);
  }
});
```

## Vue のエラーハンドリング

```javascript
// main.js
Vue.config.errorHandler = (err, vm, info) => {
  // コンポーネント内のエラーはここでキャッチされる（本番環境）
  console.error("Vue コンポーネントエラー:", err, info);
  Sentry.captureException(err, {
    extra: { componentInfo: info },
  });
};

// コンポーネント内：errorCaptured フック
export default {
  errorCaptured(err, vm, info) {
    // 子コンポーネントのエラーをキャッチ
    this.error = err.message;
    return false; // エラーの上位への伝播を止める
  },
};
```

## エラーバウンダリコンポーネント

```javascript
// エラーが起きやすい箇所をラップして、エラー時にフォールバック表示
Vue.component("ErrorBoundary", {
  data() {
    return { error: null };
  },
  errorCaptured(err) {
    this.error = err;
    return false;
  },
  render(h) {
    if (this.error) {
      return h("div", { class: "error-fallback" }, [
        h("p", "読み込みに失敗しました"),
        h(
          "button",
          {
            on: {
              click: () => {
                this.error = null;
              },
            },
          },
          "再試行",
        ),
      ]);
    }
    return this.$slots.default[0];
  },
});
```

## まとめ

- エラーの種類に応じて異なる処理をする。一律に `console.error` するだけでは不十分
- カスタムエラークラスで呼び出し側が異なる状況を正確に処理できるようにする
- `unhandledrejection` で `.catch()` が漏れた Promise をキャッチする
- Vue `errorHandler` でコンポーネントツリー内のすべてのエラーをキャッチする
- 本番環境では Sentry などのツールを導入してエラーを可視化する
