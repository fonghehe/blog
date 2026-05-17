---
title: "Electron デスクトップアプリ開発入門"
date: 2019-07-11 16:34:20
tags:
  - クロスプラットフォーム
readingTime: 3
description: "最近チームで内部ツールを作る必要がありました——JSON フォーマット/変換のデスクトップツールです。Web版でも作れましたが、ローカルファイルの読み書き、システムクリップボード、ショートカットキー登録などが必要だったため、最終的に Electron を選びました。この記事はゼロからパッケージング配布までの完全な過程を"
---

最近チームで内部ツールを作る必要がありました——JSON フォーマット/変換のデスクトップツールです。Web版でも作れましたが、ローカルファイルの読み書き、システムクリップボード、ショートカットキー登録などが必要だったため、最終的に Electron を選びました。この記事はゼロからパッケージング配布までの完全な過程を記録します。

## Electron のアーキテクチャ理解

Electron = Chromium + Node.js。Electron アプリには2種類のプロセスがあります：

**メインプロセス（Main Process）**：

- 1つだけ存在
- アプリのライフサイクルを管理
- ウィンドウ（BrowserWindow）を作成
- ネイティブシステムAPI（メニュー、トレイ、ダイアログなど）にアクセス
- Node.js コードを実行

**レンダラープロセス（Renderer Process）**：

- ウィンドウごとに1つ
- Chromium のページ
- Node.js モジュールをインポート可能
- フロントエンドコード（Vue、React など）を実行

```
+-------------------------------------------+
|              メインプロセス                  |
|  +-------------+   +-----------------+    |
|  | アプリライフ  |   | システムAPI アクセス|  |
|  | サイクル管理  |   |                 |  |
|  +-------------+   +-----------------+    |
|                                           |
|  +-------------+   +-------------+        |
|  |レンダラー1   |   |レンダラー2   |        |
|  | (BrowserWindow) | (BrowserWindow)|      |
|  | +-----------+|  |             |        |
|  | |Vue/React  ||  |             |        |
|  | |フロントエンド| |             |        |
|  | +-----------+|  |             |        |
|  +-------------+   +-------------+        |
+-------------------------------------------+
```

## プロジェクトのセットアップ

```bash
mkdir json-tools && cd json-tools
npm init -y
npm install electron --save-dev
```

プロジェクト構造：

```
json-tools/
├── main.js              # メインプロセス
├── preload.js           # プリロードスクリプト
├── renderer/            # レンダラープロセスのコード
│   ├── index.html
│   ├── app.js
│   └── style.css
├── package.json
└── electron-builder.json  # パッケージング設定
```

```json
// package.json
{
  "name": "json-tools",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:mac": "electron-builder --mac",
    "build:win": "electron-builder --win"
  },
  "devDependencies": {
    "electron": "^5.0.0",
    "electron-builder": "^20.44.0"
  }
}
```

## メインプロセスのコード

```javascript
// main.js
const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    title: "JSON ツールボックス",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("renderer/index.html");

  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", () => {
  createWindow();
  createMenu();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

## IPC 通信

```javascript
// main.js — レンダラーからのイベントを受け取る
ipcMain.on("save-file", (event, { path: filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    event.reply("save-success", { path: filePath });
  } catch (err) {
    event.reply("save-error", err.message);
  }
});

// renderer/app.js — メインプロセスにイベントを送る
const { ipcRenderer } = require("electron");

document.getElementById("save-btn").addEventListener("click", () => {
  ipcRenderer.send("save-file", {
    path: currentFilePath,
    content: editor.getValue(),
  });
});

ipcRenderer.on("save-success", (event, { path }) => {
  showNotification(`保存完了: ${path}`);
});
```

## まとめ

- Electron = Chromium + Node.js。メインプロセスがライフサイクルを管理し、レンダラーがUIを表示する
- プロセス間通信には `ipcMain`/`ipcRenderer` を使用
- `contextIsolation: false` で開発が簡単になるが、本番環境ではセキュリティを考慮すること
- `electron-builder` でMac/Windows/Linuxへのクロスプラットフォームパッケージングが可能
