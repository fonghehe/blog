---
title: "Promise チェーンとエラー処理の正しいやり方"
date: 2018-02-24 10:00:11
tags:
  - JavaScript
readingTime: 2
description: "Promise は誰もが使っていますが、エラー処理は頻繁に間違えます。よくある落とし穴と正しいパターンをまとめます。"
wordCount: 409
---

Promise は誰もが使っていますが、エラー処理は頻繁に間違えます。よくある落とし穴と正しいパターンをまとめます。

## 基本：then/catch チェーン

```javascript
fetchUser(userId)
  .then((user) => fetchProfile(user.id))
  .then((profile) => renderProfile(profile))
  .catch((error) => {
    console.error("エラー:", error);
    showError(error.message);
  });
```

チェーン内では、どのステップでエラーが throw されても、後続の `then` をすべてスキップして直接 `catch` に飛びます。

## 落とし穴 1：return を忘れる

```javascript
// ❌ 間違い：return を忘れ、fetchProfile の結果が失われる
fetchUser(userId)
  .then((user) => {
    fetchProfile(user.id); // return がない！
  })
  .then((profile) => {
    console.log(profile); // profile は undefined
  });

// ✅ 正しい
fetchUser(userId)
  .then((user) => {
    return fetchProfile(user.id); // またはアロー省略形: user => fetchProfile(user.id)
  })
  .then((profile) => {
    console.log(profile);
  });
```

## 落とし穴 2：then 内でエラーが飲み込まれる

```javascript
// ❌ この catch は then のエラーを捕捉できない
fetchUser()
  .catch((error) => console.error(error)) // catch が前にあり、後のエラーを捕捉できない
  .then((user) => {
    throw new Error("このエラーは捕捉されない");
  });

// ✅ catch をチェーンの末尾に置く
fetchUser()
  .then((user) => {
    throw new Error("このエラーは捕捉される");
  })
  .catch((error) => console.error(error));
```

## 落とし穴 3：catch 内の非同期エラー

```javascript
// ❌ catch 内の非同期エラーは捕捉されない
fetchUser().catch((error) => {
  setTimeout(() => {
    throw new Error("setTimeout 内のエラーは Promise チェーンに含まれない");
  }, 100);
});

// ✅ Promise チェーンを返す
fetchUser().catch((error) => {
  return someAsyncFallback(); // Promise を返す
});
```

## then の第2引数 vs catch

```javascript
// 方法 1：then の第2引数（fetchUser のエラーのみ捕捉）
fetchUser().then(
  (user) => processUser(user),
  (error) => handleFetchError(error), // fetchUser のエラーのみ処理
);

// 方法 2：独立した catch（チェーン全体のエラーを捕捉）
fetchUser()
  .then((user) => processUser(user))
  .catch((error) => handleError(error)); // fetchUser と processUser 両方のエラーを捕捉
```

ほとんどの場合、`.catch()` の方が明確です。

## Promise.all：並列リクエスト

```javascript
// 複数のリクエストを同時に発行し、すべて完了したら続行
const [user, settings] = await Promise.all([
  fetchUser(userId),
  fetchSettings(userId),
]);

// 注意：どれか1つが失敗すると Promise.all は reject する
// エラー耐性が必要な場合は Promise.allSettled を使う（ES2020）
const results = await Promise.allSettled([
  fetchUser(userId),
  fetchSettings(userId),
]);

results.forEach((result) => {
  if (result.status === "fulfilled") {
    console.log(result.value);
  } else {
    console.error(result.reason);
  }
});
```

## async/await のエラー処理

async/await は Promise の糖衣構文で、エラー処理には try/catch を使います：

```javascript
async function loadUserPage(userId) {
  try {
    const user = await fetchUser(userId);
    const profile = await fetchProfile(user.id);
    renderPage(user, profile);
  } catch (error) {
    // fetchUser または fetchProfile の失敗がここに来る
    handleError(error);
  }
}
```

### より細粒度のエラー処理

異なるステップのエラーを個別に処理する必要がある場合：

```javascript
async function loadUserPage(userId) {
  let user;
  try {
    user = await fetchUser(userId);
  } catch (error) {
    // fetchUser のエラーのみ処理
    redirectToLogin();
    return;
  }

  try {
    const profile = await fetchProfile(user.id);
    renderPage(user, profile);
  } catch (error) {
    // fetchProfile 失敗時のフォールバック
    renderPage(user, null); // profile なしでもレンダリング可能
  }
}
```

### 便利なユーティリティ：try/catch のラップ

```javascript
// Go 言語スタイルのエラー処理
async function to(promise) {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error, null];
  }
}

// 使用例
async function loadData() {
  const [err, user] = await to(fetchUser(userId));
  if (err) {
    handleError(err);
    return;
  }
  console.log(user);
}
```

## 未処理の Promise エラー

Node.js とブラウザは未処理の Promise rejection について警告を出します：

```javascript
// ブラウザ
window.addEventListener("unhandledrejection", (event) => {
  console.error("未処理の Promise エラー:", event.reason);
  event.preventDefault(); // コンソール出力を抑制（オプション）
});

// Node.js
process.on("unhandledRejection", (reason, promise) => {
  console.error("未処理の Promise エラー:", reason);
});
```

## まとめ

- チェーン内のすべての `then` で `return` を忘れない
- `.catch()` をチェーンの末尾に置いてチェーン全体のエラーを捕捉する
- 並列リクエストには `Promise.all`、エラー耐性が必要な場合は `Promise.allSettled`
- `async/await` では try/catch を使う。細粒度処理の場合は分けて書く
- `unhandledrejection` を監視してエラーが静かに飲み込まれるのを防ぐ
