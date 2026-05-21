---
title: "Building a Simple Virtual DOM from Scratch"
date: 2018-09-19 11:22:09
tags:
  - Frontend
readingTime: 2
description: "Virtual DOM is a core concept in React and Vue 2. After reading many articles, I felt I only truly understood it by implementing it myself. This post implements"
wordCount: 153
---

Virtual DOM is a core concept in React and Vue 2. After reading many articles, I felt I only truly understood it by implementing it myself. This post implements a minimal VDOM in a few hundred lines of code.

## Why Virtual DOM

Is operating on the real DOM really that slow? Not entirely. The real issues are:

1. Direct DOM manipulation requires manual state tracking, making code complex
2. Full DOM updates are indeed slow, but VDOM's real value is **cross-platform support** and **declarative UI**

Virtual DOM is a JS object describing a "virtual" DOM tree. Updates compare old and new VDOMs (diff) and apply only the differences to the real DOM (patch).

## Step 1: Define the VNode Structure

```javascript
// VNode: describes a DOM node
// h('div', { class: 'container' }, [h('p', null, 'Hello')])
function h(type, props, ...children) {
  return {
    type,
    props: props || {},
    children: children
      .flat()
      .map((child) =>
        typeof child === "string" ? { type: "TEXT_NODE", value: child } : child,
      ),
  };
}
```

## Step 2: VNode to Real DOM (mount)

```javascript
function createElement(vnode) {
  // Text node
  if (vnode.type === "TEXT_NODE") {
    return document.createTextNode(vnode.value);
  }

  // Element node
  const el = document.createElement(vnode.type);

  // Set attributes
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key.startsWith("on")) {
      // Event listener
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value);
    } else {
      el.setAttribute(key, value);
    }
  }

  // Recursively create child nodes
  vnode.children.forEach((child) => {
    el.appendChild(createElement(child));
  });

  // Save reference to the corresponding DOM element for patching
  vnode._el = el;

  return el;
}

// Initial mount
function mount(vnode, container) {
  const el = createElement(vnode);
  container.appendChild(el);
}
```

## Step 3: The Diff Algorithm

The most critical part — comparing old and new VNodes to find differences:

```javascript
function diff(oldVNode, newVNode) {
  // Different types: replace entirely
  if (oldVNode.type !== newVNode.type) {
    const newEl = createElement(newVNode);
    oldVNode._el.parentNode.replaceChild(newEl, oldVNode._el);
    return;
  }

  // Text node: update text
  if (newVNode.type === "TEXT_NODE") {
    if (oldVNode.value !== newVNode.value) {
      oldVNode._el.nodeValue = newVNode.value;
    }
    newVNode._el = oldVNode._el;
    return;
  }

  // Same type: reuse the DOM, update props and children
  const el = (newVNode._el = oldVNode._el);

  patchProps(el, oldVNode.props, newVNode.props);
  patchChildren(el, oldVNode.children, newVNode.children);
}

function patchProps(el, oldProps, newProps) {
  // Remove old props
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // Set new props
  for (const [key, value] of Object.entries(newProps)) {
    if (oldProps[key] !== value) {
      if (key.startsWith("on")) {
        if (oldProps[key]) {
          el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
        }
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        el.setAttribute(key, value);
      }
    }
  }
}

function patchChildren(el, oldChildren, newChildren) {
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    if (!oldChildren[i]) {
      // New node
      el.appendChild(createElement(newChildren[i]));
    } else if (!newChildren[i]) {
      // Remove node
      el.removeChild(oldChildren[i]._el);
    } else {
      // Update node
      diff(oldChildren[i], newChildren[i]);
    }
  }
}
```

## Step 4: Simple Reactivity

Combining VDOM with state updates:

```javascript
let currentVNode = null;
let container = null;

function render(vnode, mountPoint) {
  if (!currentVNode) {
    mount(vnode, mountPoint);
    container = mountPoint;
  } else {
    diff(currentVNode, vnode);
  }
  currentVNode = vnode;
}
```
