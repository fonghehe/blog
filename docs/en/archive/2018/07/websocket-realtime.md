---
title: "Getting Started with WebSocket Real-time Communication"
date: 2018-07-21 16:08:09
tags:
  - Frontend
readingTime: 2
description: "I added real-time message notifications to a project and did a deep dive into WebSocket. Here are my notes."
wordCount: 122
---

I added real-time message notifications to a project and did a deep dive into WebSocket. Here are my notes.

## WebSocket vs HTTP Polling

|             | HTTP Polling             | WebSocket                 |
| ----------- | ------------------------ | ------------------------- |
| Connection  | Establishes each request | One handshake, persistent |
| Latency     | Depends on poll interval | Real-time                 |
| Server push | Not supported            | Supported                 |
| Overhead    | HTTP headers each time   | Very small data frames    |

## Native WebSocket

```javascript
// Establish connection
const ws = new WebSocket("wss://api.example.com/ws");

// Connection opened
ws.onopen = () => {
  console.log("Connected");
  ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
};

// Receive message
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Message received:", data);
};

// Connection closed
ws.onclose = (event) => {
  console.log("Connection closed", event.code, event.reason);
};

// Error occurred
ws.onerror = (error) => {
  console.error("WebSocket error", error);
};

// Send message
ws.send(JSON.stringify({ type: "message", content: "Hello" }));

// Close manually
ws.close();
```

## Encapsulation: Auto-reconnect

Production environments need to handle reconnections:

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

// Usage
const ws = new ReconnectingWebSocket("wss://api.example.com/ws")
  .on("open", () => ws.send({ type: "auth", token: getToken() }))
  .on("message", (data) => handleMessage(data))
  .on("close", () => updateConnectionStatus("offline"));
```

## Using in Vue

```javascript
// src/plugins/websocket.js
export default {
  install(Vue) {
    const ws = new ReconnectingWebSocket(process.env.VUE_APP_WS_URL)

    ws.on('message', (data) => {
      // broadcast via event bus
      Vue.prototype.$bus.$emit(`ws:${data.type}`, data.payload)
    })

    Vue.prototype.$ws = ws
  }
}

// In a component
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

If you need more features (rooms, namespaces, automatic fallback to polling), use Socket.io:

```javascript
import io from "socket.io-client";

const socket = io("https://api.example.com", {
  transports: ["websocket"], // disable polling fallback, use WebSocket directly
  auth: { token: getToken() },
});

socket.on("connect", () => console.log("Connected"));
socket.on("notification", (data) => showNotification(data));
socket.emit("message", { room: "general", text: "Hello" });
```

## Summary

- WebSocket maintains a persistent connection and supports bidirectional communication with great real-time performance
- Production environments need reconnection handling
- Native API is sufficient when Socket.io's extra features aren't needed
- Remember to remove event listeners when components are destroyed to prevent memory leaks
