---
title: "MCP 协议：连接前端工具链的桥梁"
date: 2025-04-05 10:00:00
tags:
  - 前端
---

MCP（Model Context Protocol）正在成为 AI 与工具之间的标准协议。来聊聊前端工程师如何利用 MCP 提升开发效率。

## 什么是 MCP

```
MCP = Model Context Protocol

本质：让 AI 模型能安全地调用外部工具和数据源
类比：API 之于 Web 应用，MCP 之于 AI 模型

支持者：Anthropic（Claude）、各大 IDE、开发工具
```

## MCP 架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Model   │────▶│  MCP Client │────▶│  MCP Server │
│  (Claude)   │◀────│  (IDE/CLI)  │◀────│  (Tool)     │
└─────────────┘     └─────────────┘     └─────────────┘

MCP Server 提供：
  - Resources：数据源（文件、数据库、API）
  - Tools：可执行的操作
  - Prompts：预设的 prompt 模板
```

## 实战：搭建 Figma MCP Server

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

## 实战：前端项目分析 MCP Server

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

## 在 Claude Code 中配置 MCP

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

配置好之后，在 Claude Code 中就可以直接说："帮我分析这个项目的依赖使用情况"，AI 会自动调用 MCP 工具。

## 小结

- MCP 是 AI 工具调用的标准化协议，解决了 "AI 怎么访问外部工具" 的问题
- 前端工具链（Figma、ESLint、测试框架）都可以包装成 MCP Server
- Claude Code 原生支持 MCP，配置简单
- 自建 MCP Server 的门槛不高，SDK 做了大量封装
- 2025 年，MCP 生态正在快速扩张，值得持续关注
