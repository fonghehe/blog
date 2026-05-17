---
title: "WebSocketリアルタイム通信入門"
date: 2018-07-21 16:08:09
tags:
  - フロントエンド
readingTime: 2
description: "プロジェクトにリアルタイムのメッセージ通知機能を追加するためにWebSocketを調べました。まとめておきます。"
---

プロジェクトにリアルタイムのメッセージ通知機能を追加するためにWebSocketを調べました。まとめておきます。

## WebSocket vs HTTPポーリング

|                  | HTTPポーリング         | WebSocket                    |
| ---------------- | ---------------------- | ---------------------------- |
| 接続             | リクエストごとに再確立 | 1回のハンドシェイクで持続    |
| 遅延             | ポーリング間隔に依存   | リアルタイム                 |
| サーバープッシュ | 非サポート             | サポート                     |
| オーバーヘッド   | 毎回HTTPヘッダーが必要 | データフレームが非常に小さい |

## ネイティブWebSocket

```javascript
// 接続を確立
const ws = new WebSocket("wss://api.example.com/ws");

// 接続成功
ws.onopen = () => {
  console.log("接続しました");
  ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
};

// メッセージ受信
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("メッセージを受信:", data);
};

// 接続クローズ
ws.onclose = (event) => {
  console.log("接続がクローズされました", event.code, event.reason);
};

// エラー発生
ws.onerror = (error) => {
  console.error("WebSocketエラー", error);
};

// メッセージ送信
ws.send(JSON.stringify({ type: "message", content: "Hello" }));

// 手動でクローズ
ws.close();
```

## カプセル化：自動再接続

本番環境では切断時の再接続処理が必要です：

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

// 使用例
const ws = new ReconnectingWebSocket("wss://api.example.com/ws")
  .on("open", () => ws.send({ type: "auth", token: getToken() }))
  .on("message", (data) => handleMessage(data))
  .on("close", () => updateConnectionStatus("offline"));
```

## Vueでの使い方

```javascript
// src/plugins/websocket.js
export default {
  install(Vue) {
    const ws = new ReconnectingWebSocket(process.env.VUE_APP_WS_URL)

    ws.on('message', (data) => {
      // イベントバスで配信
      Vue.prototype.$bus.$emit(`ws:${data.type}`, data.payload)
    })

    Vue.prototype.$ws = ws
  }
}

// コンポーネント内で使用
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

より多くの機能（ルーム、名前空間、ポーリングへの自動フォールバック）が必要な場合はSocket.ioを使います：

```javascript
import io from "socket.io-client";

const socket = io("https://api.example.com", {
  transports: ["websocket"], // ポーリングフォールバックを無効化。WebSocketを直接使用
  auth: { token: getToken() },
});

socket.on("connect", () => console.log("接続しました"));
socket.on("notification", (data) => showNotification(data));
socket.emit("message", { room: "general", text: "Hello" });
```

## まとめ

- WebSocketは持続的な接続を維持し、双方向通信をサポート。リアルタイム性が高い
- 本番環境では再接続処理が必要
- Socket.ioの追加機能が不要なときはネイティブAPIで十分
- コンポーネント破棄時にイベントリスナーを削除してメモリリークを防ぐ
