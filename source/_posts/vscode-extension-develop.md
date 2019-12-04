---
title: "VS Code 插件开发入门"
date: 2019-12-04 14:54:06
tags:
  - 前端
---

作为前端工程师，VS Code 几乎是每天都要打交道的编辑器。最近团队需要一个内部工具——自动扫描项目中的 TODO/FIXME 并生成任务列表，我决定用 VS Code 插件来实现。这次开发经历让我对 VS Code 的扩展体系有了比较完整的认识，整理成文分享给大家。

## 环境搭建与项目结构

VS Code 插件开发需要 Node.js 和 Yeoman 脚手架：

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

## package.json 中的 contributes

`contributes` 是插件能力声明的核心。通过它，你可以注册命令、菜单项、快捷键、配置项等，而不需要写任何运行时代码：

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

## 激活事件（Activation Events）

插件不会在 VS Code 启动时立即加载，而是通过激活事件按需激活，这对性能很重要：

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

实际开发中，建议尽量使用具体的激活事件。我们的插件只需要在用户执行命令或打开视图时激活，不需要 `*` 全量激活。

## 命令注册与核心逻辑

插件的入口文件 `extension.ts` 负责注册命令和初始化：

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

## TreeView 实现

TreeView 是 VS Code 侧边栏展示层级数据的标准方式。对于我们的 TODO 列表，TreeView 非常合适：

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

当需要展示更复杂的内容（图表、表单、交互式界面）时，TreeView 就不够用了，需要用 Webview：

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

## 调试与发布

开发过程中的调试和最终发布都很方便：

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

## 小结

- `package.json` 的 `contributes` 字段是插件能力声明的核心，理解它是开发插件的第一步
- 激活事件要精确指定，避免使用 `*` 全量激活影响 VS Code 启动速度
- 命令注册是插件的核心逻辑入口，所有 UI 交互都围绕命令展开
- TreeView 适合展示层级数据，Webview 适合复杂交互界面
- CSP 策略是 Webview 安全的基本要求，务必配置
- 调试体验很好，F5 即可启动开发窗口，支持断点调试
