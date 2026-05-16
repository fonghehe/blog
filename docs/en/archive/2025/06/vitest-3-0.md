---
title: "Vitest 3.0 New Features"
date: 2025-06-16 10:00:00
tags:
  - Engineering
  - Testing
readingTime: 1
description: "We've recently rolled out Vitest 3.0 in our team and accumulated a good deal of experience. Sharing it here as a reference, hoping it helps others tackling simi"
---

We've recently rolled out Vitest 3.0 in our team and accumulated a good deal of experience. Sharing it here as a reference, hoping it helps others tackling similar challenges.

## Quick Start

Let's start by looking at the basic implementation:

```javascript
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("form submission", async () => {
  const user = userEvent.setup();
  render(<LoginForm />);

  await user.type(screen.getByLabelText("邮箱"), "test@example.com");
  await user.type(screen.getByLabelText("密码"), "password123");
  await user.click(screen.getByRole("button", { name: "登录" }));

  await expect(screen.findByText("登录成功")).resolves.toBeInTheDocument();
});
```

This snippet illustrates the fundamental usage. In real projects you'll also need to account for error handling and edge cases.

## Under the Hood

In a real project, the usage gets a bit more complex:

```javascript
// webpack.config.js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: "./src/index.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash].js",
    clean: true,
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader", exclude: /node_modules/ },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: "./public/index.html" }),
    new MiniCssExtractPlugin({ filename: "[name].[contenthash].css" }),
  ],
};
```

This approach improves both the testability and scalability of the code.

## Case Studies

Here is a complete example:

```javascript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          utils: ["lodash", "date-fns"],
        },
      },
    },
  },
  server: { proxy: { "/api": "http://localhost:3000" } },
});
```

Pay attention to edge-case handling—this is crucial in production environments.

## Summary

- Always verify compatibility before using in production
- In team collaboration, conventions and documentation matter more than the technology itself
- Stay up-to-date with community trends; technical solutions require continuous iteration
