---
title: "Electron 桌面應用開發入門"
date: 2019-07-11 16:34:20
tags:
  - 跨平臺
readingTime: 5
description: "最近團隊需要做一個內部工具——JSON 格式化/轉換桌面小工具。Web 版本當然可以做，但涉及到本地檔案讀寫、系統剪貼簿、快捷鍵註冊等能力，最終選擇了 Electron。這篇文章記錄了從零搭建到打包分發的完整過程。"
wordCount: 669
---

最近團隊需要做一個內部工具——JSON 格式化/轉換桌面小工具。Web 版本當然可以做，但涉及到本地檔案讀寫、系統剪貼簿、快捷鍵註冊等能力，最終選擇了 Electron。這篇文章記錄了從零搭建到打包分發的完整過程。

## Electron 架構理解

Electron = Chromium + Node.js。一個 Electron 應用有兩種程序：

**主程序（Main Process）**：
- 隻有一個
- 管理應用生命週期
- 建立視窗（BrowserWindow）
- 訪問系統原生 API（選單、托盤、對話方塊等）
- 執行 Node.js 程式碼

**渲染程序（Renderer Process）**：
- 每個視窗一個
- 就是一個 Chromium 頁面
- 可以引入 Node.js 模組
- 執行前端程式碼（Vue、React 等）

```
+
-------------------------------------------+
|                主程序                      |
|  +-------------+   +-----------------+    |
|  | app 生命週期  |   |  系統 API 訪問   |    |
|  +-------------+   +-----------------+    |
|                                           |
|  +-------------+   +-------------+        |
|  | 渲染程序 1   |   | 渲染程序 2   |        |
|  | (BrowserWindow) | (BrowserWindow) |     |
|  | +-----------+|  |             |        |
|  | |Vue/React  ||  |             |        |
|  | |前端程式碼    ||  |             |        |
|  | +-----------+|  |             |        |
|  +-------------+   +-------------+        |
+-------------------------------------------+
```

## 專案搭建

```bash
mkdir json-tools && cd json-tools
npm init -y
npm install electron --save-dev
```

專案結構：

```
json-tools/
├── main.js              # 主程序
├── preload.js            # 預載入指令碼
├── renderer/             # 渲染程序程式碼
│   ├── index.html
│   ├── app.js
│   └── style.css
├── package.json
└── electron-builder.json  # 打包配置
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

## 主程序程式碼

```javascript
// main.js
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    title: 'JSON 工具箱',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile('renderer/index.html')

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
  createWindow()
  createMenu()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

function createMenu() {
  const template = [
    {
      label: '檔案',
      submenu: [
        {
          label: '開啟 JSON 檔案',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile()
        },
        {
          label: '儲存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '編輯',
      submenu: [
        { role: 'undo', label: '撤銷' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪下' },
        { role: 'copy', label: '複製' },
        { role: 'paste', label: '貼上' }
      ]
    },
    {
      label: '檢視',
      submenu: [
        { role: 'reload', label: '重新載入' },
        { role: 'toggledevtools', label: '開發者工具' },
        { type: 'separator' },
        { role: 'zoomin', label: '放大' },
        { role: 'zoomout', label: '縮小' },
        { role: 'resetzoom', label: '重置縮放' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function openFile() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const content = fs.readFileSync(filePath, 'utf-8')
      mainWindow.webContents.send('file-opened', {
        path: filePath,
        content
      })
    }
  }).catch(err => {
    console.error(err)
  })
}

// IPC 通訊：處理渲染程序的請求
ipcMain.handle('format-json', async (event, jsonString) => {
  try {
    const parsed = JSON.parse(jsonString)
    return { success: true, result: JSON.stringify(parsed, null, 2) }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('save-file', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return { success: true }
  }
  return { success: false }
})
```

## IPC 通訊詳解

主程序和渲染程序之間的通訊是 Electron 開發的核心。

### 渲染程序 -> 主程序

```javascript
// 方式一：invoke/handle（推薦，非同步請求-響應模式）
// 主程序
ipcMain.handle('some-action', async (event, arg) => {
  const result = await doSomething(arg)
  return result
})

// 渲染程序
const { ipcRenderer } = require('electron')
const result = await ipcRenderer.invoke('some-action', data)
```

```javascript
// 方式二：send/on（單向通知）
// 主程序
ipcMain.on('log-message', (event, message) => {
  console.log('收到訊息:', message)
})

// 渲染程序
ipcRenderer.send('log-message', 'hello from renderer')
```

### 主程序 -> 渲染程序

```javascript
// 主程序
mainWindow.webContents.send('update-data', { foo: 'bar' })

// 渲染程序
ipcRenderer.on('update-data', (event, data) => {
  console.log('收到更新:', data)
})
```

### 預載入指令碼（安全的橋樑）

`nodeIntegration: true` 存在安全風險（渲染程序可以直接訪問 Node.js）。更安全的做法是用 `preload` 指令碼暴露有限的 API：

```javascript
// preload.js
const { ipcRenderer, contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  formatJson: (json) => ipcRenderer.invoke('format-json', json),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
  onMenuSave: (callback) => ipcRenderer.on('menu-save', callback)
})
```

```html
<!-- renderer/index.html -->
<body>
  <div class="container">
    <textarea id="input" placeholder="貼上 JSON 內容..."></textarea>
    <button id="format">格式化</button>
    <button id="save">儲存</button>
    <pre id="output"></pre>
  </div>
  <script src="app.js"></script>
</body>
```

```javascript
// renderer/app.js
const input = document.getElementById('input')
const output = document.getElementById('output')

document.getElementById('format').addEventListener('click', async () => {
  const result = await window.electronAPI.formatJson(input.value)
  if (result.success) {
    output.textContent = result.result
    output.className = 'success'
  } else {
    output.textContent = '錯誤: ' + result.error
    output.className = 'error'
  }
})

document.getElementById('save').addEventListener('click', async () => {
  await window.electronAPI.saveFile(output.textContent)
})

window.electronAPI.onFileOpened((event, data) => {
  input.value = data.content
  document.title = data.path + ' - JSON 工具箱'
})

window.electronAPI.onMenuSave(() => {
  document.getElementById('save').click()
})
```

## 打包分發

使用 `electron-builder` 打包：

```json
// electron-builder.json
{
  "appId": "com.example.json-tools",
  "productName": "JSON工具箱",
  "directories": {
    "output": "dist"
  },
  "files": [
    "main.js",
    "preload.js",
    "renderer/**/*"
  ],
  "mac": {
    "category": "public.app-category.developer-tools",
    "target": ["dmg", "zip"]
  },
  "win": {
    "target": ["nsis", "portable"]
  },
  "linux": {
    "target": ["AppImage", "deb"]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

```bash
npm run build
npm run build:win
npm run build:mac
```

## autoUpdater：自動更新

```javascript
// main.js
const { autoUpdater } = require('electron-updater')

function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available')
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.error('更新出錯:', err)
  })
}

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  createWindow()
  createMenu()
  checkForUpdates()
})
```

## 踩坑記錄

### 坑 1：打包後找不到模組

確保 `electron-builder.json` 的 `files` 欄位包含了所有需要的檔案。如果用了 Vue CLI 或 Webpack，需要指定打包輸出目錄：

```json
{
  "files": [
    "dist/main.js",
    "dist/renderer/**/*"
  ]
}
```

### 坑 2：macOS 下無法開啟（未簽名）

macOS 上未簽名的應用會被 Gatekeeper 阻止。開發階段可以右鍵開啟，生產環境需要購買 Apple Developer 證書籤名：

```json
{
  "mac": {
    "identity": "Your Developer ID",
    "hardenedRuntime": true,
    "entitlements": "entitlements.mac.plist"
  }
}
```

### 坑 3：記憶體佔用過高

Electron 應用記憶體佔用普遍較高。最佳化方向：
- 避免在渲染程序載入大量資料
- 用 `webFrame.setZoomLevelLimits(1, 1)` 限製縮放範圍
- 視窗隱藏時釋放不必要的資源
- 考慮用 `BrowserView` 代替多視窗

### 坑 4：nodeIntegration 安全問題

如果應用載入外部 URL，`nodeIntegration: true` 意味著任何網頁都能執行系統命令。務必：
- 關閉 `nodeIntegration`，開啟 `contextIsolation`
- 用 `preload` + `contextBridge` 暴露有限 API
- 不要載入不受信任的 URL

## 小結

- Electron = Chromium + Node.js，主程序管理視窗和系統 API，渲染程序跑前端程式碼
- IPC 通訊是核心，推薦 `invoke/handle` 模式（請求-響應）和 `send/on` 模式（單向通知）
- 生產環境務必關閉 `nodeIntegration`，用 `preload` + `contextBridge` 安全暴露 API
- `electron-builder` 負責打包，支援 macOS/Windows/Linux 多平臺
- `electron-updater` 實現自動更新，需要搭配靜態檔案伺服器或 GitHub Releases
- 注意記憶體佔用和安全問題，不要在 Electron 中載入不受信任的外部頁面
