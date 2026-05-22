---
title: "MCP プロトコル：フロントエンドツールチェーンの橋渡し"
date: 2025-04-05 16:59:36
tags:
  - フロントエンド
readingTime: 3
description: "MCP（Model Context Protocol）はAIとツール間の標準プロトコルになりつつあります。フロントエンドエンジニアがMCPを活用して開発効率を向上させる方法を解説します。"
wordCount: 356
---

MCP（Model Context Protocol）はAIとツール間の標準プロトコルになりつつあります。フロントエンドエンジニアがMCPを活用して開発効率を向上させる方法を解説します。

## MCPとは何か

```
MCP = Model Context Protocol

本質：AIモデルが外部ツールとデータソースを安全に呼び出せるようにする
例え：WebアプリにAPIがあるように、AIモデルにはMCPがある

サポート：Anthropic（Claude）、主要IDE、開発ツール
```

## MCPアーキテクチャ

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Model   │────▶│  MCP Client │────▶│  MCP Server │
│  (Claude)   │◀────│  (IDE/CLI)  │◀────│  (Tool)     │
└─────────────┘     └─────────────┘     └─────────────┘

MCP Server が提供するもの：
  - Resources：データソース（ファイル、データベース、API）
  - Tools：実行可能な操作
  - Prompts：プリセットのプロンプトテンプレート
```

## 実践：Figma MCPサーバーの構築

```ts
// figma-mcp-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "figma-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// 注册工具：获取 Figma 设计稿信息
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "get_figma_file",
      description: "获取 Figma 文件的结构和组件信息",
      inputSchema: {
        type: "object",
        properties: {
          fileKey: { type: "string", description: "Figma 文件 key" },
          nodeId: { type: "string", description: "节点 ID（可选）" },
        },
        required: ["fileKey"],
      },
    },
    {
      name: "export_figma_assets",
      description: "导出 Figma 中的图标和图片资源",
      inputSchema: {
        type: "object",
        properties: {
          fileKey: { type: "string" },
          format: { type: "string", enum: ["svg", "png", "jpg"] },
          scale: { type: "number", default: 1 },
        },
        required: ["fileKey", "format"],
      },
    },
  ],
}));

// 处理工具调用
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_figma_file") {
    const response = await fetch(
      `https://api.figma.com/v1/files/${args.fileKey}`,
      {
        headers: { "X-Figma-Token": process.env.FIGMA_TOKEN! },
      },
    );
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// 启动服务
const transport = new StdioServerTransport();
await server.connect(transport);
```

## 実践：フロントエンドプロジェクト解析 MCPサーバー

```ts
// project-analyzer-mcp.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { glob } from "glob";
import fs from "fs/promises";

const server = new Server(
  { name: "project-analyzer", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "analyze_dependencies",
      description: "分析项目依赖关系和未使用的包",
      inputSchema: {
        type: "object",
        properties: {
          projectRoot: { type: "string" },
        },
        required: ["projectRoot"],
      },
    },
    {
      name: "find_unused_exports",
      description: "查找未被引用的导出",
      inputSchema: {
        type: "object",
        properties: {
          projectRoot: { type: "string" },
          pattern: { type: "string", default: "src/**/*.{ts,tsx}" },
        },
        required: ["projectRoot"],
      },
    },
    {
      name: "component_usage_report",
      description: "生成组件使用频率报告",
      inputSchema: {
        type: "object",
        properties: {
          projectRoot: { type: "string" },
        },
        required: ["projectRoot"],
      },
    },
  ],
}));

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "analyze_dependencies") {
    const pkgJson = JSON.parse(
      await fs.readFile(`${args.projectRoot}/package.json`, "utf-8"),
    );
    const allFiles = await glob(`${args.projectRoot}/src/**/*.{ts,tsx}`);
    const imports = new Set<string>();

    for (const file of allFiles) {
      const content = await fs.readFile(file, "utf-8");
      const matches = content.matchAll(/from ['"]([^'"]+)['"]/g);
      for (const match of matches) {
        if (!match[1].startsWith(".") && !match[1].startsWith("@/")) {
          imports.add(
            match[1]
              .split("/")
              .slice(0, match[1].startsWith("@") ? 2 : 1)
              .join("/"),
          );
        }
      }
    }

    const deps = Object.keys(pkgJson.dependencies || {});
    const unused = deps.filter((d) => !imports.has(d));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ used: [...imports], unused }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Claude CodeでMCPを設定する

```json
// .claude/mcp.json
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["./mcp-servers/figma-mcp-server.js"],
      "env": {
        "FIGMA_TOKEN": "${FIGMA_TOKEN}"
      }
    },
    "project-analyzer": {
      "command": "node",
      "args": ["./mcp-servers/project-analyzer.js"]
    }
  }
}
```

設定後、Claude Codeに直接「このプロジェクトの依存関係の使用状況を分析してください」と伝えるだけで、AIが自動的にMCPツールを呼び出します。

## まとめ

- MCPはAIツール呼び出しの標準プロトコルで、「AIが外部ツールにどうアクセスするか」という問題を解決します
- フロントエンドツールチェーン（Figma、ESLint、テストフレームワーク）はすべてMCP Serverとしてラップできます
- Claude CodeはMCPをネイティブサポートしており、シンプルな設定で利用可能です
- 独自のMCP Serverを構築するハードルは低く、SDKが重い部分のほとんどを処理してくれます
- 2025年にMCPエコシステムは急速に拡大中—注目する価値があります
