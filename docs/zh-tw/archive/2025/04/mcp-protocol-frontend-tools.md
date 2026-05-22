---
title: "MCP 協議：連線前端工具鏈的橋樑"
date: 2025-04-05 16:59:36
tags:
  - 前端
readingTime: 2
description: "MCP（Model Context Protocol）正在成為 AI 與工具之間的標準協議。來聊聊前端工程師如何利用 MCP 提升開發效率。"
wordCount: 208
---

MCP（Model Context Protocol）正在成為 AI 與工具之間的標準協議。來聊聊前端工程師如何利用 MCP 提升開發效率。

## 什麼是 MCP

```
MCP = Model Context Protocol

本質：讓 AI 模型能安全地呼叫外部工具和資料來源
類比：API 之於 Web 應用，MCP 之於 AI 模型

支持者：Anthropic（Claude）、各大 IDE、開發工具
```

## MCP 架構

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Model   │────▶│  MCP Client │────▶│  MCP Server │
│  (Claude)   │◀────│  (IDE/CLI)  │◀────│  (Tool)     │
└─────────────┘     └─────────────┘     └─────────────┘

MCP Server 提供：
  - Resources：資料來源（檔案、資料庫、API）
  - Tools：可執行的操作
  - Prompts：預設的 prompt 模板
```

## 實戰：搭建 Figma MCP Server

```ts
// figma-mcp-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "figma-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// 註冊工具：獲取 Figma 設計稿資訊
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "get_figma_file",
      description: "獲取 Figma 檔案的結構和元件資訊",
      inputSchema: {
        type: "object",
        properties: {
          fileKey: { type: "string", description: "Figma 檔案 key" },
          nodeId: { type: "string", description: "節點 ID（可選）" },
        },
        required: ["fileKey"],
      },
    },
    {
      name: "export_figma_assets",
      description: "匯出 Figma 中的圖示和圖片資源",
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

// 處理工具呼叫
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

// 啟動服務
const transport = new StdioServerTransport();
await server.connect(transport);
```

## 實戰：前端專案分析 MCP Server

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
      description: "分析專案依賴關係和未使用的包",
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
      description: "查詢未被引用的匯出",
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
      description: "生成元件使用頻率報告",
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
          imports.add(match[1].split("/").slice(0, match[1].startsWith("@") ? 2 : 1).join("/"));
        }
      }
    }

    const deps = Object.keys(pkgJson.dependencies || {});
    const unused = deps.filter((d) => !imports.has(d));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ used: [...imports], unused }, null, 2),
      }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## 在 Claude Code 中設定 MCP

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

配置好之後，在 Claude Code 中就可以直接說："幫我分析這個專案的依賴使用情況"，AI 會自動呼叫 MCP 工具。

## 小結

- MCP 是 AI 工具呼叫的標準化協議，解決了 "AI 怎麼訪問外部工具" 的問題
- 前端工具鏈（Figma、ESLint、測試框架）都可以包裝成 MCP Server
- Claude Code 原生支援 MCP，配置簡單
- 自建 MCP Server 的門檻不高，SDK 做了大量封裝
- 2025 年，MCP 生態正在快速擴張，值得持續關注
