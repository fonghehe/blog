---
title: "VS Code Extension Development Introduction"
date: 2019-12-04 14:54:06
tags:
  - Frontend
readingTime: 6
description: "As frontend engineers, VS Code is an editor we touch almost every day. Recently the team needed an internal tool—one that automatically scans the project for TODO/FIXME markers and generates a task list—so I decided to build it as a VS Code extension. This development experience gave me a fairly complete picture of VS Code's extension system, and I'm writing it up to share."
wordCount: 330
---

As frontend engineers, VS Code is an editor we touch almost every day. Recently the team needed an internal tool—one that automatically scans the project for TODO/FIXME markers and generates a task list—so I decided to build it as a VS Code extension. This development experience gave me a fairly complete picture of VS Code's extension system, and I'm writing it up to share.

## Environment Setup and Project Structure

VS Code extension development needs Node.js and the Yeoman scaffolding:

```bash
# 安装脚手架工具
npm install -g yo generator-code

# 生成插件项目
yo code
# 选择 TypeScript + New Extension

# 生成的项目结构
my-extension/
  ├── .vscode/          # 开发调试配置
  ├── src/
  │   └── extension.ts  # 插件入口
  ├── package.json      # 插件清单（核心配置文件）
  ├── tsconfig.json
  └── .vscodeignore     # 打包时忽略的文件
```

## contributes in package.json

`contributes` is the core of an extension's capability declaration. Through it you can register commands, menu items, keybindings, and configuration options—without writing any runtime code:

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
        "title": "扫描项目 TODO",
        "category": "TODO Scanner"
      },
      {
        "command": "todoScanner.refresh",
        "title": "刷新列表",
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
          "description": "要扫描的关键词列表"
        },
        "todoScanner.exclude": {
          "type": "array",
          "default": ["node_modules", "dist", ".git"],
          "description": "扫描时排除的目录"
        },
        "todoScanner.severity": {
          "type": "string",
          "enum": ["info", "warning", "error"],
          "default": "warning",
          "description": "标记的严重级别"
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

## Activation Events

An extension is not loaded immediately when VS Code starts; instead it is activated on demand through activation events, which matters for performance:

```json
// 常用的激活事件
{
  "activationEvents": [
    // 用户执行特定命令时激活
    "onCommand:todoScanner.scan",

    // 打开特定视图时激活
    "onView:todoExplorer",

    // 打开特定类型文件时激活
    "onLanguage:typescript",
    "onLanguage:javascript",

    // VS Code 启动时激活（尽量避免，影响启动速度）
    "*",

    // 匹配特定文件模式时激活
    "onFileSystem:https",

    // 搜索时激活
    "onSearch:todo-scanner"
  ]
}
```

In practice, prefer specific activation events wherever possible. Our extension only needs to activate when the user runs a command or opens a view, so it does not need the `*` full-scope activation.

## Command Registration and Core Logic

The extension's entry file `extension.ts` is responsible for registering commands and initializing:

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
  console.log('TODO Scanner 插件已激活')

  // 注册扫描命令
  const scanCommand = vscode.commands.registerCommand(
    'todoScanner.scan',
    async () => {
      const items = await scanWorkspace()
      if (items.length === 0) {
        vscode.window.showInformationMessage('没有发现 TODO/FIXME 标记')
        return
      }

      // 在输出面板展示结果
      const outputChannel = vscode.window.createOutputChannel('TODO Scanner')
      outputChannel.clear()
      outputChannel.appendLine(`扫描结果：共 ${items.length} 条标记`)
      outputChannel.appendLine('='.repeat(50))

      items.forEach(item => {
        outputChannel.appendLine(
          `[${item.keyword}] ${item.file}:${item.line} - ${item.text}`
        )
      })

      outputChannel.show()
      vscode.window.showInformationMessage(
        `扫描完成，发现 ${items.length} 条标记`
      )
    }
  )

  // 注册树视图提供者
  const treeDataProvider = new TodoTreeProvider()
  const treeView = vscode.window.createTreeView('todoExplorer', {
    treeDataProvider
  })

  // 注册刷新命令
  const refreshCommand = vscode.commands.registerCommand(
    'todoScanner.refresh',
    () => {
      treeDataProvider.refresh()
    }
  )

  // 监听文件保存事件，自动刷新
  const onSave = vscode.workspace.onDidSaveTextDocument(() => {
    treeDataProvider.refresh()
  })

  // 将所有 disposables 注册到 context
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

  // 搜索所有文件
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
  // 清理资源
}
```

## TreeView Implementation

TreeView is the standard way to show hierarchical data in the VS Code sidebar. For our TODO list, TreeView fits perfectly:

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
      // 根节点：按文件分组
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
      // 子节点：具体的 TODO 项
      return (element.todoItems || []).map(item => {
        const treeItem = new TodoTreeItem(
          `[${item.keyword}] ${item.text}`,
          vscode.TreeItemCollapsibleState.None,
          item.file
        )

        treeItem.tooltip = `${item.file}:${item.line}`
        treeItem.description = `第 ${item.line} 行`

        // 点击跳转到对应行
        treeItem.command = {
          command: 'vscode.open',
          title: '打开文件',
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

        // 根据关键词设置图标
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
    // 复用前面的 scanWorkspace 逻辑
    // 简化示例
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

When you need to present more complex content—charts, forms, interactive interfaces—TreeView is no longer enough and you need a Webview:

```typescript
import * as vscode from 'vscode'

function createWebviewPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'todoDashboard',
    'TODO 仪表盘',
    vscode.ViewColumn.One,
    {
      // 启用脚本
      enableScripts: true,
      // 限制资源加载来源
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'media'))
      ],
      // 离开编辑器时保留状态
      retainContextWhenHidden: true
    }
  )

  // 设置 HTML 内容
  panel.webview.html = getWebviewContent(panel.webview, context.extensionUri)

  // 处理来自 Webview 的消息
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'navigate':
          // 跳转到指定文件和行号
          const uri = vscode.Uri.file(message.filePath)
          vscode.window.showTextDocument(uri, {
            selection: new vscode.Range(
              message.line - 1, 0,
              message.line - 1, 999
            )
          })
          return

        case 'getStats':
          // 发送统计数据到 Webview
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
  // 引用本地资源需要转换为 webview 可访问的 URI
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
  <title>TODO 仪表盘</title>
</head>
<body>
  <div id="app">
    <h1>项目 TODO 统计</h1>
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

## Debugging and Publishing

Both debugging during development and final publishing are quite convenient:

```bash
# 调试：按 F5 启动 Extension Development Host
# VS Code 会打开一个新窗口，加载你的插件
# 在源码中打断点即可调试

# 打包
npm install -g vsce
vsce package
# 生成 todo-scanner-1.0.0.vsix

# 发布到 Marketplace（需要 Personal Access Token）
vsce login your-publisher-name
vsce publish

# 发布特定版本
vsce publish minor  # 1.0.0 -> 1.1.0
vsce publish patch  # 1.0.0 -> 1.0.1
```

## Summary

- The `contributes` field in `package.json` is the core of an extension's capability declaration; understanding it is the first step in extension development
- Specify activation events precisely and avoid `*` full-scope activation, which slows VS Code startup
- Command registration is the core logic entry point of an extension; all UI interactions revolve around commands
- TreeView suits hierarchical data, while Webview suits complex interactive interfaces
- A CSP policy is the basic security requirement for Webviews and must be configured
- The debugging experience is great: F5 launches the development host window with breakpoint support
