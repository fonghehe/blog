---
title: "Deep Dive into Browser Event Mechanisms"
date: 2018-09-05 10:46:42
tags:
  - Frontend
readingTime: 2
description: "Browser events are fundamental to frontend development, but many developers lack a deep understanding of event capturing, bubbling, and delegation. Here's a sys"
wordCount: 108
---

Browser events are fundamental to frontend development, but many developers lack a deep understanding of event capturing, bubbling, and delegation. Here's a systematic overview.

## The Three Phases of Event Flow

When a user clicks an element, the browser goes through three phases:

```
Window
  └── Document
        └── html
              └── body
                    └── div#container  (1. Capture phase ↓)
                          └── button   (2. Target phase)
                    └── div#container  (3. Bubble phase ↑)
```

```javascript
// addEventListener's third argument: true = capture phase, false (default) = bubble phase
element.addEventListener("click", handler, true); // capture
element.addEventListener("click", handler, false); // bubble (default)

// Recommended options object syntax for clarity
element.addEventListener("click", handler, { capture: true });
```

## Stopping Bubbling

```javascript
document.getElementById("child").addEventListener("click", (e) => {
  e.stopPropagation(); // Stop event from continuing to bubble
  // e.stopImmediatePropagation()  // Also stops other listeners on the same element
});
```

## Event Delegation

Instead of attaching events to every child element, handle them on the parent using bubbling:

```javascript
// Bad approach: binding to every li (high memory usage, breaks for dynamically added elements)
document.querySelectorAll("li").forEach((li) => {
  li.addEventListener("click", handleItemClick);
});

// Good approach: delegate to the parent
document.getElementById("list").addEventListener("click", (e) => {
  const li = e.target.closest("li"); // closest traverses up to find the nearest li
  if (!li) return;

  const id = li.dataset.id;
  handleItemClick(id);
});

// Dynamically added li elements also respond to the event ✅
const newLi = document.createElement("li");
newLi.dataset.id = "100";
newLi.textContent = "New item";
document.getElementById("list").appendChild(newLi);
```

## e.target vs e.currentTarget

```javascript
document.getElementById("parent").addEventListener("click", (e) => {
  console.log(e.target); // The element that actually triggered the event (could be a child)
  console.log(e.currentTarget); // The element the listener is attached to (parent)
});
```

## Common Mouse Events

```javascript
element.addEventListener("mouseenter", () => {}); // Enter element, doesn't bubble
element.addEventListener("mouseleave", () => {}); // Leave element, doesn't bubble
element.addEventListener("mouseover", () => {}); // Enter element or child, bubbles
element.addEventListener("mouseout", () => {}); // Leave element or child, bubbles
```

`mouseenter` / `mouseleave` don't fire when passing over child elements — usually the better choice.

## Common Keyboard Events

```javascript
document.addEventListener("keydown", (e) => {
  console.log(e.key); // 'Enter', 'Escape', 'ArrowUp', etc.
  console.log(e.code); // 'KeyA', 'Digit1', etc. (physical key)
  console.log(e.keyCode); // Deprecated, use e.key instead

  // Key combinations
  if (e.ctrlKey && e.key === "z") {
    /* Ctrl+Z */
  }
  if (e.metaKey && e.key === "s") {
    /* Cmd+S */
  }
  if (e.shiftKey && e.key === "Enter") {
    /* Shift+Enter */
  }
});
```

## Custom Events

```javascript
// Create and dispatch a custom event
const event = new CustomEvent("user:login", {
  bubbles: true,
  cancelable: true,
  detail: { userId: 123, username: "Alice" },
});

document.dispatchEvent(event);

// Listen for the custom event
document.addEventListener("user:login", (e) => {
  console.log(e.detail.username); // 'Alice'
});
```

This can be used for cross-component communication in Vue (though Vuex is more appropriate).

## Debounce for High-Frequency Events

```javascript
// scroll/resize/input and other high-frequency events need debouncing
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

window.addEventListener(
  "resize",
  debounce(() => {
    console.log("Executes only after resize stops");
  }, 300),
);
```

## Removing Event Listeners

```javascript
// Common memory leak: attaching events without cleaning them up
class Component {
  handleClick = () => {};

  mount() {
    document.addEventListener("click", this.handleClick);
  }

  destroy() {
    document.removeEventListener("click", this.handleClick); // Must clean up
  }
}
```
