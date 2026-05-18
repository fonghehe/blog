---
title: "WebSocket 实时通信入门"
date: 2018-07-21 16:08:09
tags:
  - 前端
readingTime: 2
description: "项目里加了实时消息通知功能，研究了一下 WebSocket，记录一下。"
---

项目里加了实时消息通知功能，研究了一下 WebSocket，记录一下。

## WebSocket vs HTTP 轮询

|            | HTTP 轮询            | WebSocket          |
| 
---------- | -------------------- | ------------------ |
| 连接       | 每次请求重新建立     | 一次握手，持久连接 |
| 延迟       | 依赖轮询间隔         | 实时               |
| 服务器推送 | 不支持               | 支持               |
| 开销       | 每次请求都有 HTTP 头 | 数据帧很小         |

## 原生 WebSocket

```javascript
// 建立连接
const ws = new WebSocket("wss://api.example.com/ws");

// 连接成功
ws.onopen = () => {
  console.log("已连接");
  ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
};

// 接收消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("收到消息:", data);
};

// 连接关闭
ws.onclose = (event) => {
  console.log("连接关闭", event.code, event.reason);
};

// 发生错误
ws.onerror = (error) => {
  console.error("WebSocket 错误", error);
};

// 发送消息
ws.send(JSON.stringify({ type: "message", content: "Hello" }));

// 主动关闭
ws.close();
```

## 封装：自动重连

生产环境需要处理断线重连：

```javascript
class ReconnectingWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.maxReconnects = options.maxReconnects || 10;
    this.reconnectCount = 0;
    this.handlers = {};
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectCount = 0;
      this.emit("open");
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.emit("message", data);
      } catch {
        this.emit("message", e.data);
      }
    };

    this.ws.onclose = (e) => {
      this.emit("close", e);
      if (!this.manualClose && this.reconnectCount < this.maxReconnects) {
        this.reconnectCount++;
        setTimeout(() => this.connect(), this.reconnectDelay);
      }
    };

    this.ws.onerror = (e) => this.emit("error", e);
  }

  on(event, handler) {
    this.handlers[event] = handler;
    return this;
  }

  emit(event, data) {
    this.handlers[event]?.(data);
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }

  close() {
    this.manualClose = true;
    this.ws.close();
  }
}

// 使用
const ws = new ReconnectingWebSocket("wss://api.example.com/ws")
  .on("open", () => ws.send({ type: "auth", token: getToken() }))
  .on("message", (data) => handleMessage(data))
  .on("close", () => updateConnectionStatus("offline"));
```

## 在 Vue 中使用

```javascript
// src/plugins/websocket.js
export default {
  install(Vue) {
    const ws = new ReconnectingWebSocket(process.env.VUE_APP_WS_URL)

    ws.on('message', (data) => {
      // 通过事件总线广播
      Vue.prototype.$bus.$emit(`ws:${data.type}`, data.payload)
    })

    Vue.prototype.$ws = ws
  }
}

// 组件中使用
export default {
  mounted() {
    this.$bus.$on('ws:notification', this.handleNotification)
  },
  beforeDestroy() {
    this.$bus.$off('ws:notification', this.handleNotification)
  },
  methods: {
    handleNotification(data) {
      this.$notify({ title: data.title, message: data.body })
    }
  }
}
```

## Socket.io

如果需要更多功能（房间、事件命名空间、自动降级到轮询），用 Socket.io：

```javascript
import io from "socket.io-client";

const socket = io("https://api.example.com", {
  transports: ["websocket"], // 禁用轮询降级，直接用 WebSocket
  auth: { token: getToken() },
});

socket.on("connect", () => console.log("已连接"));
socket.on("notification", (data) => showNotification(data));
socket.emit("message", { room: "general", text: "Hello" });
```

## 小结

- WebSocket 持久连接，支持双向通信，实时性好
- 生产环境需要处理断线重连
- 原生 API 够用时不需要引入 Socket.io
- 注意在组件销毁时取消监听，防止内存泄漏
