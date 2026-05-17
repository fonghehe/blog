---
title: "React Portals でグローバルモーダルを実装する"
date: 2019-07-17 10:28:31
tags:
  - React
readingTime: 2
description: "React Portals を使うと、コンポーネントの子要素を親コンポーネントの DOM 階層外の DOM ノードにレンダリングできます。overflow/z-index の制約を突破する必要があるモーダル、ツールチップ、ドロップダウンなどに特に有用です。"
---

React Portals を使うと、コンポーネントの子要素を親コンポーネントの DOM 階層外の DOM ノードにレンダリングできます。overflow/z-index の制約を突破する必要があるモーダル、ツールチップ、ドロップダウンなどに特に有用です。

## なぜ Portals が必要か

コンポーネント内にモーダルコードを置くと生じる問題：

```jsx
function Dashboard() {
  return (
    <div style={{ overflow: "hidden", position: "relative" }}>
      {/* overflow: hidden がモーダルをクリップしてしまう！ */}
      <Modal>コンテンツ</Modal>
    </div>
  );
}
```

Portals は React のコンテキストを保持したまま、異なる DOM ノードにレンダリングすることでこれを解決します。

## 基本的な使い方

```jsx
import { createPortal } from "react-dom";

function Modal({ children, onClose }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body, // 通常の DOM 階層の外にレンダリング
  );
}
```

## 完全なモーダル実装

```jsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function Modal({ isOpen, onClose, title, children }) {
  const overlayRef = useRef(null);

  // モーダル表示時にボディのスクロールをロック
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape キーで閉じる
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
          <button onClick={onClose} aria-label="閉じる">
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

## グローバルモーダルマネージャー

大規模アプリでは、グローバルなモーダル管理システムで prop のバケツリレーを避けられます：

```jsx
// ModalContext.jsx
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

// アプリ内のどこからでも使える
function SomeComponent() {
  const { openModal } = useModal();

  return (
    <button
      onClick={() =>
        openModal({
          title: "削除の確認",
          content: <DeleteConfirmation />,
        })
      }
    >
      削除
    </button>
  );
}
```

## まとめ

- `createPortal` は React のコンテキストを保持したまま、子要素を異なる DOM ノードにレンダリングする
- Portal を使ってもイベントバブリングは通常通り機能する（DOMツリーではなくReactのコンポーネントツリーを通じてバブリングする）
- ボディのスクロールロックと Escape キーのサポートは良いUXに欠かせない
- 大規模アプリではグローバルモーダルマネージャーでネストが深いモーダル状態管理を避けられる
