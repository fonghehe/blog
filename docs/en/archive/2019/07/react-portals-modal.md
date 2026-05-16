---
title: "React Portals: Implementing Global Modals"
date: 2019-07-17 10:28:31
tags:
  - React
readingTime: 2
description: "React Portals allow you to render a component's children into a DOM node outside the parent component hierarchy. This is particularly useful for modals, tooltip"
---

React Portals allow you to render a component's children into a DOM node outside the parent component hierarchy. This is particularly useful for modals, tooltips, and dropdowns that need to break out of overflow/z-index constraints.

## Why Portals?

The problem with placing modal code inside a component:

```jsx
function Dashboard() {
  return (
    <div style={{ overflow: "hidden", position: "relative" }}>
      {/* overflow: hidden clips the modal! */}
      <Modal>Content</Modal>
    </div>
  );
}
```

Portals solve this by rendering into a different DOM node while keeping React context intact.

## Basic Usage

```jsx
import { createPortal } from "react-dom";

function Modal({ children, onClose }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body, // Render outside the normal DOM hierarchy
  );
}
```

## Full Modal Implementation

```jsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function Modal({ isOpen, onClose, title, children }) {
  const overlayRef = useRef(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="modal-container" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
```

## Global Modal Manager

For large applications, a global modal management system avoids prop drilling:

```jsx
// ModalContext.jsx
import React, { createContext, useContext, useState, useCallback } from "react";
import Modal from "./Modal";

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modals, setModals] = useState([]);

  const openModal = useCallback((config) => {
    const id = Date.now();
    setModals((prev) => [...prev, { id, ...config }]);
    return id;
  }, []);

  const closeModal = useCallback((id) => {
    setModals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {modals.map((modal) => (
        <Modal
          key={modal.id}
          isOpen={true}
          title={modal.title}
          onClose={() => closeModal(modal.id)}
        >
          {modal.content}
        </Modal>
      ))}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}

// Usage anywhere in the app
function SomeComponent() {
  const { openModal } = useModal();

  return (
    <button
      onClick={() =>
        openModal({
          title: "Confirm Delete",
          content: <DeleteConfirmation />,
        })
      }
    >
      Delete
    </button>
  );
}
```

## CSS

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  min-width: 400px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
```

## Summary

- `createPortal` renders children into a different DOM node while keeping React context intact
- Event bubbling still works normally even with portals (events bubble up through React's component tree, not the DOM tree)
- Body scroll locking and Escape key support are essential for good UX
- For large apps, a global modal manager avoids deeply nested modal state
