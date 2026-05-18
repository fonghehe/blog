---
title: "WebSocket 即時通訊入門"
date: 2018-07-21 16:08:09
tags:
  - 前端
readingTime: 2
description: "專案里加了即時訊息通知功能，研究了一下 WebSocket，記錄一下。"
---

專案里加了即時訊息通知功能，研究了一下 WebSocket，記錄一下。

## WebSocket vs HTTP 輪詢

|            | HTTP 輪詢            | WebSocket          |
| 
---------- | -------------------- | ------------------ |
| 連線       | 每次請求重新建立     | 一次握手，持久連線 |
| 延遲       | 依賴輪詢間隔         | 即時               |
| 伺服器推送 | 不支援               | 支援               |
| 開銷       | 每次請求都有 HTTP 頭 | 資料幀很小         |

## 原生 WebSocket

```javascript
// 建立連線
const ws = new WebSocket("wss://api.example.com/ws");

// 連線成功
ws.onopen = () => {
  console.log("已連線");
  ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
};

// 接收訊息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("收到訊息:", data);
};

// 連線關閉
ws.onclose = (event) => {
  console.log("連線關閉", event.code, event.reason);
};

// 發生錯誤
ws.onerror = (error) => {
  console.error("WebSocket 錯誤", error);
};

// 傳送訊息
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
      // 通過事件匯流排廣播
      Vue.prototype.$bus.$emit(`ws:${data.type}`, data.payload)
    })

    Vue.prototype.$ws = ws
  }
}

// 元件中使用
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

如果需要更多功能（房間、事件名稱空間、自動降級到輪詢），用 Socket.io：

```javascript
import io from "socket.io-client";

const socket = io("https://api.example.com", {
  transports: ["websocket"], // 停用輪詢降級，直接用 WebSocket
  auth: { token: getToken() },
});

socket.on("connect", () => console.log("已連線"));
socket.on("notification", (data) => showNotification(data));
socket.emit("message", { room: "general", text: "Hello" });
```

## 小結

- WebSocket 持久連線，支援雙向通訊，即時性好
- 生產環境需要處理斷線重連
- 原生 API 夠用時不需要引入 Socket.io
- 注意在元件銷燬時取消監聽，防止記憶體洩漏
