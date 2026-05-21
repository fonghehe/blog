---
title: "Getting Started with Electron Desktop App Development"
date: 2019-07-11 16:34:20
tags:
  - Cross-platform
readingTime: 2
description: "Recently our team needed to build an internal tool — a JSON formatting/conversion desktop utility. A web version was certainly possible, but it required local f"
wordCount: 153
---

Recently our team needed to build an internal tool — a JSON formatting/conversion desktop utility. A web version was certainly possible, but it required local file read/write, system clipboard access, and hotkey registration, so we ended up choosing Electron. This article documents the complete journey from zero to packaged distribution.

## Understanding the Electron Architecture

Electron = Chromium + Node.js. An Electron application has two types of processes:

**Main Process**:

- Only one instance
- Manages application lifecycle
- Creates windows (BrowserWindow)
- Accesses native system APIs (menus, tray, dialogs, etc.)
- Runs Node.js code

**Renderer Process**:

- One per window
- Essentially a Chromium page
- Can import Node.js modules
- Runs frontend code (Vue, React, etc.)

```
+-------------------------------------------+
|               Main Process                 |
|  +-------------+   +-----------------+    |
|  | App Lifecycle|   | System API Access|   |
|  +-------------+   +-----------------+    |
|                                           |
|  +-------------+   +-------------+        |
|  | Renderer 1  |   | Renderer 2  |        |
|  | (BrowserWindow) | (BrowserWindow) |     |
|  | +-----------+|  |             |        |
|  | |Vue/React  ||  |             |        |
|  | |Frontend   ||  |             |        |
|  | +-----------+|  |             |        |
|  +-------------+   +-------------+        |
+-------------------------------------------+
```

## Project Setup

```bash
mkdir json-tools && cd json-tools
npm init -y
npm install electron --save-dev
```

Project structure:

```
json-tools/
├── main.js              # Main process
├── preload.js           # Preload script
├── renderer/            # Renderer process code
│   ├── index.html
│   ├── app.js
│   └── style.css
├── package.json
└── electron-builder.json  # Packaging config
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

## Main Process Code

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
    title: "JSON Toolbox",
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

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open JSON File",
          accelerator: "CmdOrCtrl+O",
          click: () => openFile(),
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow.webContents.send("menu-save"),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggledevtools" },
        { type: "separator" },
        { role: "zoomin" },
        { role: "zoomout" },
        { role: "resetzoom" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function openFile() {
  dialog
    .showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        { name: "JSON", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    })
    .then((result) => {
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, "utf-8");
        mainWindow.webContents.send("file-opened", {
          path: filePath,
          content,
        });
      }
    });
}
```

## IPC Communication

```javascript
// main.js — listen for events from renderer
ipcMain.on("save-file", (event, { path: filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    event.reply("save-success", { path: filePath });
  } catch (err) {
    event.reply("save-error", err.message);
  }
});

// renderer/app.js — send events to main
const { ipcRenderer } = require("electron");

document.getElementById("save-btn").addEventListener("click", () => {
  ipcRenderer.send("save-file", {
    path: currentFilePath,
    content: editor.getValue(),
  });
});

ipcRenderer.on("save-success", (event, { path }) => {
  showNotification(`Saved: ${path}`);
});
```

## Packaging for Distribution

```json
// electron-builder.json
{
  "appId": "com.yourname.json-tools",
  "productName": "JSON Toolbox",
  "directories": {
    "output": "release"
  },
  "mac": {
    "category": "public.app-category.developer-tools",
    "icon": "assets/icon.icns"
  },
  "win": {
    "icon": "assets/icon.ico",
    "target": "nsis"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

## Summary

- Electron = Chromium + Node.js, main process manages lifecycle, renderer displays UI
- Use `ipcMain`/`ipcRenderer` for process communication
- `contextIsolation: false` simplifies development, but consider security in production
- Multi-stage packaging via `electron-builder` supports Mac/Windows/Linux
