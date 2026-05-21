---
title: "WebSocket 實時通信入門"
date: 2018-07-21 16:08:09
tags:
  - 前端
readingTime: 2
description: "項目里加了實時消息通知功能，研究了一下 WebSocket，記錄一下。"
wordCount: 203
---

項目里加了實時消息通知功能，研究了一下 WebSocket，記錄一下。

## WebSocket vs HTTP 輪詢

|            | HTTP 輪詢            | WebSocket          |
| 
---------- | -------------------- | ------------------ |
| 連接       | 每次請求重新建立     | 一次握手，持久連接 |
| 延遲       | 依賴輪詢間隔         | 實時               |
| 服務器推送 | 不支持               | 支持               |
| 開銷       | 每次請求都有 HTTP 頭 | 數據幀很小         |

## 原生 WebSocket

```javascript
// 建立連接
const ws = new WebSocket("wss://api.example.com/ws");

// 連接成功
ws.onopen = () => {
  console.log("已連接");
  ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
};

// 接收消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("收到消息:", data);
};

// 連接關閉
ws.onclose = (event) => {
  console.log("連接關閉", event.code, event.reason);
};

// 發生錯誤
ws.onerror = (error) => {
  console.error("WebSocket 錯誤", error);
};

// 發送消息
ws.send(JSON.stringify({ type: "message", content: "Hello" }));

// 主動關閉
ws.close();
```

## 封裝：自動重連

生產環境需要處理斷線重連：

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
      // 通過事件總線廣播
      Vue.prototype.$bus.$emit(`ws:${data.type}`, data.payload)
    })

    Vue.prototype.$ws = ws
  }
}

// 組件中使用
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

如果需要更多功能（房間、事件命名空間、自動降級到輪詢），用 Socket.io：

```javascript
import io from "socket.io-client";

const socket = io("https://api.example.com", {
  transports: ["websocket"], // 禁用輪詢降級，直接用 WebSocket
  auth: { token: getToken() },
});

socket.on("connect", () => console.log("已連接"));
socket.on("notification", (data) => showNotification(data));
socket.emit("message", { room: "general", text: "Hello" });
```

## 小結

- WebSocket 持久連接，支持雙向通信，實時性好
- 生產環境需要處理斷線重連
- 原生 API 夠用時不需要引入 Socket.io
- 注意在組件銷燬時取消監聽，防止內存泄漏
