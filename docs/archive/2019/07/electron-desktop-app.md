---
title: "Electron 桌面应用开发入门"
date: 2019-07-11 16:34:20
tags:
  - 跨平台
readingTime: 5
description: "最近团队需要做一个内部工具——JSON 格式化/转换桌面小工具。Web 版本当然可以做，但涉及到本地文件读写、系统剪贴板、快捷键注册等能力，最终选择了 Electron。这篇文章记录了从零搭建到打包分发的完整过程。"
---

最近团队需要做一个内部工具——JSON 格式化/转换桌面小工具。Web 版本当然可以做，但涉及到本地文件读写、系统剪贴板、快捷键注册等能力，最终选择了 Electron。这篇文章记录了从零搭建到打包分发的完整过程。

## Electron 架构理解

Electron = Chromium + Node.js。一个 Electron 应用有两种进程：

**主进程（Main Process）**：
- 只有一个
- 管理应用生命周期
- 创建窗口（BrowserWindow）
- 访问系统原生 API（菜单、托盘、对话框等）
- 运行 Node.js 代码

**渲染进程（Renderer Process）**：
- 每个窗口一个
- 就是一个 Chromium 页面
- 可以引入 Node.js 模块
- 运行前端代码（Vue、React 等）

```
+
-------------------------------------------+
|                主进程                      |
|  +-------------+   +-----------------+    |
|  | app 生命周期  |   |  系统 API 访问   |    |
|  +-------------+   +-----------------+    |
|                                           |
|  +-------------+   +-------------+        |
|  | 渲染进程 1   |   | 渲染进程 2   |        |
|  | (BrowserWindow) | (BrowserWindow) |     |
|  | +-----------+|  |             |        |
|  | |Vue/React  ||  |             |        |
|  | |前端代码    ||  |             |        |
|  | +-----------+|  |             |        |
|  +-------------+   +-------------+        |
+-------------------------------------------+
```

## 项目搭建

```bash
mkdir json-tools && cd json-tools
npm init -y
npm install electron --save-dev
```

项目结构：

```
json-tools/
├── main.js              # 主进程
├── preload.js            # 预加载脚本
├── renderer/             # 渲染进程代码
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

## 主进程代码

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
      label: '文件',
      submenu: [
        {
          label: '打开 JSON 文件',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile()
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggledevtools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'zoomin', label: '放大' },
        { role: 'zoomout', label: '缩小' },
        { role: 'resetzoom', label: '重置缩放' }
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

// IPC 通信：处理渲染进程的请求
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

## IPC 通信详解

主进程和渲染进程之间的通信是 Electron 开发的核心。

### 渲染进程 -> 主进程

```javascript
// 方式一：invoke/handle（推荐，异步请求-响应模式）
// 主进程
ipcMain.handle('some-action', async (event, arg) => {
  const result = await doSomething(arg)
  return result
})

// 渲染进程
const { ipcRenderer } = require('electron')
const result = await ipcRenderer.invoke('some-action', data)
```

```javascript
// 方式二：send/on（单向通知）
// 主进程
ipcMain.on('log-message', (event, message) => {
  console.log('收到消息:', message)
})

// 渲染进程
ipcRenderer.send('log-message', 'hello from renderer')
```

### 主进程 -> 渲染进程

```javascript
// 主进程
mainWindow.webContents.send('update-data', { foo: 'bar' })

// 渲染进程
ipcRenderer.on('update-data', (event, data) => {
  console.log('收到更新:', data)
})
```

### 预加载脚本（安全的桥梁）

`nodeIntegration: true` 存在安全风险（渲染进程可以直接访问 Node.js）。更安全的做法是用 `preload` 脚本暴露有限的 API：

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
    <textarea id="input" placeholder="粘贴 JSON 内容..."></textarea>
    <button id="format">格式化</button>
    <button id="save">保存</button>
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
    output.textContent = '错误: ' + result.error
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

## 打包分发

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

## autoUpdater：自动更新

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
    console.error('更新出错:', err)
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

## 踩坑记录

### 坑 1：打包后找不到模块

确保 `electron-builder.json` 的 `files` 字段包含了所有需要的文件。如果用了 Vue CLI 或 Webpack，需要指定打包输出目录：

```json
{
  "files": [
    "dist/main.js",
    "dist/renderer/**/*"
  ]
}
```

### 坑 2：macOS 下无法打开（未签名）

macOS 上未签名的应用会被 Gatekeeper 阻止。开发阶段可以右键打开，生产环境需要购买 Apple Developer 证书签名：

```json
{
  "mac": {
    "identity": "Your Developer ID",
    "hardenedRuntime": true,
    "entitlements": "entitlements.mac.plist"
  }
}
```

### 坑 3：内存占用过高

Electron 应用内存占用普遍较高。优化方向：
- 避免在渲染进程加载大量数据
- 用 `webFrame.setZoomLevelLimits(1, 1)` 限制缩放范围
- 窗口隐藏时释放不必要的资源
- 考虑用 `BrowserView` 代替多窗口

### 坑 4：nodeIntegration 安全问题

如果应用加载外部 URL，`nodeIntegration: true` 意味着任何网页都能执行系统命令。务必：
- 关闭 `nodeIntegration`，开启 `contextIsolation`
- 用 `preload` + `contextBridge` 暴露有限 API
- 不要加载不受信任的 URL

## 小结

- Electron = Chromium + Node.js，主进程管理窗口和系统 API，渲染进程跑前端代码
- IPC 通信是核心，推荐 `invoke/handle` 模式（请求-响应）和 `send/on` 模式（单向通知）
- 生产环境务必关闭 `nodeIntegration`，用 `preload` + `contextBridge` 安全暴露 API
- `electron-builder` 负责打包，支持 macOS/Windows/Linux 多平台
- `electron-updater` 实现自动更新，需要搭配静态文件服务器或 GitHub Releases
- 注意内存占用和安全问题，不要在 Electron 中加载不受信任的外部页面
