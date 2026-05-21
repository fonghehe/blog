---
title: "VS Code 外掛開發入門"
date: 2019-12-04 14:54:06
tags:
  - 前端
readingTime: 6
description: "作為前端工程師，VS Code 幾乎是每天都要打交道的編輯器。最近團隊需要一個內部工具——自動掃描專案中的 TODO/FIXME 並生成任務列表，我決定用 VS Code 外掛來實現。這次開發經歷讓我對 VS Code 的擴充套件體系有了比較完整的認識，整理成文分享給大家。"
wordCount: 527
---

作為前端工程師，VS Code 幾乎是每天都要打交道的編輯器。最近團隊需要一個內部工具——自動掃描專案中的 TODO/FIXME 並生成任務列表，我決定用 VS Code 外掛來實現。這次開發經歷讓我對 VS Code 的擴充套件體系有了比較完整的認識，整理成文分享給大家。

## 環境搭建與專案結構

VS Code 外掛開發需要 Node.js 和 Yeoman 腳手架：

```bash
# 安裝腳手架工具
npm install -g yo generator-code

# 生成外掛專案
yo code
# 選擇 TypeScript + New Extension

# 生成的專案結構
my-extension/
  ├── .vscode/          # 開發除錯配置
  ├── src/
  │   └── extension.ts  # 外掛入口
  ├── package.json      # 外掛清單（核心配置檔案）
  ├── tsconfig.json
  └── .vscodeignore     # 打包時忽略的檔案
```

## package.json 中的 contributes

`contributes` 是外掛能力宣告的核心。通過它，你可以註冊命令、選單項、快捷鍵、配置項等，而不需要寫任何執行時程式碼：

```json
{
  "name": "todo-scanner",
  "displayName": "TODO Scanner",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.30.0"
  },
  "activationEvents": [
    "onCommand:todoScanner.scan",
    "onView:todoExplorer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "todoScanner.scan",
        "title": "掃描專案 TODO",
        "category": "TODO Scanner"
      },
      {
        "command": "todoScanner.refresh",
        "title": "重新整理列表",
        "category": "TODO Scanner",
        "icon": "$(refresh)"
      }
    ],
    "menus": {
      "editor/title": [
        {
          "command": "todoScanner.scan",
          "group": "navigation",
          "when": "editorTextFocus"
        }
      ],
      "view/title": [
        {
          "command": "todoScanner.refresh",
          "when": "view == todoExplorer",
          "group": "navigation"
        }
      ],
      "explorer/context": [
        {
          "command": "todoScanner.scan",
          "group": "1_modification"
        }
      ]
    },
    "keybindings": [
      {
        "command": "todoScanner.scan",
        "key": "ctrl+shift+t",
        "mac": "cmd+shift+t",
        "when": "editorTextFocus"
      }
    ],
    "configuration": {
      "title": "TODO Scanner",
      "properties": {
        "todoScanner.keywords": {
          "type": "array",
          "default": ["TODO", "FIXME", "HACK", "BUG"],
          "description": "要掃描的關鍵詞列表"
        },
        "todoScanner.exclude": {
          "type": "array",
          "default": ["node_modules", "dist", ".git"],
          "description": "掃描時排除的目錄"
        },
        "todoScanner.severity": {
          "type": "string",
          "enum": ["info", "warning", "error"],
          "default": "warning",
          "description": "標記的嚴重級別"
        }
      }
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "todo-scanner",
          "title": "TODO Scanner",
          "icon": "$(checklist)"
        }
      ]
    },
    "views": {
      "todo-scanner": [
        {
          "id": "todoExplorer",
          "name": "TODO 列表",
          "when": "workspaceFolderCount > 0"
        }
      ]
    }
  }
}
```

## 啟用事件（Activation Events）

外掛不會在 VS Code 啟動時立即載入，而是通過啟用事件按需啟用，這對效能很重要：

```json
// 常用的啟用事件
{
  "activationEvents": [
    // 使用者執行特定命令時啟用
    "onCommand:todoScanner.scan",

    // 開啟特定檢視時啟用
    "onView:todoExplorer",

    // 開啟特定型別檔案時啟用
    "onLanguage:typescript",
    "onLanguage:javascript",

    // VS Code 啟動時啟用（儘量避免，影響啟動速度）
    "*",

    // 匹配特定檔案模式時啟用
    "onFileSystem:https",

    // 搜尋時啟用
    "onSearch:todo-scanner"
  ]
}
```

實際開發中，建議儘量使用具體的啟用事件。我們的外掛只需要在使用者執行命令或開啟檢視時啟用，不需要 `*` 全量啟用。

## 命令註冊與核心邏輯

外掛的入口檔案 `extension.ts` 負責註冊命令和初始化：

```typescript
import * as vscode from 'vscode'
import * as path from 'path'

interface TodoItem {
  file: string
  line: number
  column: number
  keyword: string
  text: string
}

export function activate(context: vscode.ExtensionContext) {
  console.log('TODO Scanner 外掛已啟用')

  // 註冊掃描命令
  const scanCommand = vscode.commands.registerCommand(
    'todoScanner.scan',
    async () => {
      const items = await scanWorkspace()
      if (items.length === 0) {
        vscode.window.showInformationMessage('沒有發現 TODO/FIXME 標記')
        return
      }

      // 在輸出面板展示結果
      const outputChannel = vscode.window.createOutputChannel('TODO Scanner')
      outputChannel.clear()
      outputChannel.appendLine(`掃描結果：共 ${items.length} 條標記`)
      outputChannel.appendLine('='.repeat(50))

      items.forEach(item => {
        outputChannel.appendLine(
          `[${item.keyword}] ${item.file}:${item.line} - ${item.text}`
        )
      })

      outputChannel.show()
      vscode.window.showInformationMessage(
        `掃描完成，發現 ${items.length} 條標記`
      )
    }
  )

  // 註冊樹檢視提供者
  const treeDataProvider = new TodoTreeProvider()
  const treeView = vscode.window.createTreeView('todoExplorer', {
    treeDataProvider
  })

  // 註冊重新整理命令
  const refreshCommand = vscode.commands.registerCommand(
    'todoScanner.refresh',
    () => {
      treeDataProvider.refresh()
    }
  )

  // 監聽檔案儲存事件，自動重新整理
  const onSave = vscode.workspace.onDidSaveTextDocument(() => {
    treeDataProvider.refresh()
  })

  // 將所有 disposables 註冊到 context
  context.subscriptions.push(
    scanCommand,
    refreshCommand,
    treeView,
    onSave
  )
}

async function scanWorkspace(): Promise<TodoItem[]> {
  const config = vscode.workspace.getConfiguration('todoScanner')
  const keywords = config.get<string[]>('keywords', ['TODO', 'FIXME'])
  const exclude = config.get<string[]>('exclude', ['node_modules'])

  const items: TodoItem[] = []
  const excludePattern = `{${exclude.join(',')&#125;&#125;`

  // 搜尋所有檔案
  const files = await vscode.workspace.findFiles(
    '**/*.{ts,tsx,js,jsx,vue,css,scss}',
    excludePattern
  )

  for (const fileUri of files) {
    const document = await vscode.workspace.openTextDocument(fileUri)
    const text = document.getText()
    const lines = text.split('\n')

    lines.forEach((line, index) => {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b[:\\s]?(.*)`, 'i')
        const match = line.match(regex)
        if (match) {
          items.push({
            file: vscode.workspace.asRelativePath(fileUri),
            line: index + 1,
            column: match.index! + 1,
            keyword: keyword.toUpperCase(),
            text: match[1].trim() || line.trim()
          })
        }
      }
    })
  }

  return items
}

export function deactivate() {
  // 清理資源
}
```

## TreeView 實現

TreeView 是 VS Code 側邊欄展示層級資料的標準方式。對於我們的 TODO 列表，TreeView 非常合適：

```typescript
import * as vscode from 'vscode'
import * as path from 'path'

interface TodoItem {
  file: string
  line: number
  keyword: string
  text: string
}

class TodoTreeProvider implements vscode.TreeDataProvider<TodoTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TodoTreeItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private items: TodoItem[] = []

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined)
  }

  getTreeItem(element: TodoTreeItem): vscode.TreeItem {
    return element
  }

  async getChildren(element?: TodoTreeItem): Promise<TodoTreeItem[]> {
    if (!element) {
      // 根節點：按檔案分組
      this.items = await this.scanFiles()
      const fileGroups = this.groupByFile(this.items)

      return Object.keys(fileGroups).map(file => {
        const count = fileGroups[file].length
        return new TodoTreeItem(
          `${file} (${count})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          file,
          fileGroups[file]
        )
      })
    } else {
      // 子節點：具體的 TODO 項
      return (element.todoItems || []).map(item => {
        const treeItem = new TodoTreeItem(
          `[${item.keyword}] ${item.text}`,
          vscode.TreeItemCollapsibleState.None,
          item.file
        )

        treeItem.tooltip = `${item.file}:${item.line}`
        treeItem.description = `第 ${item.line} 行`

        // 點選跳轉到對應行
        treeItem.command = {
          command: 'vscode.open',
          title: '開啟檔案',
          arguments: [
            vscode.Uri.file(
              path.join(vscode.workspace.rootPath || '', item.file)
            ),
            {
              selection: new vscode.Range(
                item.line - 1, 0,
                item.line - 1, 999
              )
            }
          ]
        }

        // 根據關鍵詞設定圖示
        switch (item.keyword) {
          case 'FIXME':
            treeItem.iconPath = new vscode.ThemeIcon('warning')
            break
          case 'BUG':
            treeItem.iconPath = new vscode.ThemeIcon('bug')
            break
          default:
            treeItem.iconPath = new vscode.ThemeIcon('circle-outline')
        }

        return treeItem
      })
    }
  }

  private async scanFiles(): Promise<TodoItem[]> {
    // 複用前面的 scanWorkspace 邏輯
    // 簡化示例
    return []
  }

  private groupByFile(items: TodoItem[]): Record<string, TodoItem[]> {
    return items.reduce((acc, item) => {
      if (!acc[item.file]) acc[item.file] = []
      acc[item.file].push(item)
      return acc
    }, {} as Record<string, TodoItem[]>)
  }
}

class TodoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath: string,
    public readonly todoItems?: TodoItem[]
  ) {
    super(label, collapsibleState)
  }
}
```

## Webview Panel

當需要展示更復雜的內容（圖表、表單、互動式介面）時，TreeView 就不夠用了，需要用 Webview：

```typescript
import * as vscode from 'vscode'

function createWebviewPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'todoDashboard',
    'TODO 儀表盤',
    vscode.ViewColumn.One,
    {
      // 啟用指令碼
      enableScripts: true,
      // 限制資源載入來源
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'media'))
      ],
      // 離開編輯器時保留狀態
      retainContextWhenHidden: true
    }
  )

  // 設定 HTML 內容
  panel.webview.html = getWebviewContent(panel.webview, context.extensionUri)

  // 處理來自 Webview 的訊息
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'navigate':
          // 跳轉到指定檔案和行號
          const uri = vscode.Uri.file(message.filePath)
          vscode.window.showTextDocument(uri, {
            selection: new vscode.Range(
              message.line - 1, 0,
              message.line - 1, 999
            )
          })
          return

        case 'getStats':
          // 傳送統計資料到 Webview
          panel.webview.postMessage({
            command: 'statsData',
            data: {
              total: 42,
              todo: 28,
              fixme: 10,
              bug: 4
            }
          })
          return
      }
    },
    undefined,
    context.subscriptions
  )
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // 引用本地資源需要轉換為 webview 可訪問的 URI
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionUri.fsPath, 'media', 'main.js'))
  )
  const styleUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionUri.fsPath, 'media', 'main.css'))
  )

  // CSP（Content Security Policy）防止 XSS
  const nonce = getNonce()

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
    style-src ${webview.cspSource};
    script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>TODO 儀表盤</title>
</head>
<body>
  <div id="app">
    <h1>專案 TODO 統計</h1>
    <div class="stats-grid">
      <div class="stat-card" id="todo-count">TODO: --</div>
      <div class="stat-card" id="fixme-count">FIXME: --</div>
      <div class="stat-card" id="bug-count">BUG: --</div>
    </div>
    <div id="chart-container"></div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

function getNonce(): string {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
```

## 除錯與釋出

開發過程中的除錯和最終釋出都很方便：

```bash
# 除錯：按 F5 啟動 Extension Development Host
# VS Code 會開啟一個新視窗，載入你的外掛
# 在原始碼中打斷點即可除錯

# 打包
npm install -g vsce
vsce package
# 生成 todo-scanner-1.0.0.vsix

# 釋出到 Marketplace（需要 Personal Access Token）
vsce login your-publisher-name
vsce publish

# 釋出特定版本
vsce publish minor  # 1.0.0 -> 1.1.0
vsce publish patch  # 1.0.0 -> 1.0.1
```

## 小結

- `package.json` 的 `contributes` 欄位是外掛能力宣告的核心，理解它是開發外掛的第一步
- 啟用事件要精確指定，避免使用 `*` 全量啟用影響 VS Code 啟動速度
- 命令註冊是外掛的核心邏輯入口，所有 UI 互動都圍繞命令展開
- TreeView 適合展示層級資料，Webview 適合複雜互動介面
- CSP 策略是 Webview 安全的基本要求，務必配置
- 除錯體驗很好，F5 即可啟動開發視窗，支援斷點除錯
