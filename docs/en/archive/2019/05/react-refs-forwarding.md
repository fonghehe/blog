---
title: "React Refs Forwarding and Use Cases"
date: 2019-05-16 17:14:10
tags:
  - React
readingTime: 1
description: "I recently used React ref forwarding in a project and found it more complex than expected. Here is a summary of the experience gained in practice."
wordCount: 114
---

I recently used React ref forwarding in a project and found it more complex than expected. Here is a summary of the experience gained in practice.

## Core Principle

`useRef` returns a mutable object with a `current` property that persists for the lifetime of the component. Unlike state, updating `current` does not trigger a re-render.

```javascript
import React, { useRef, useEffect } from "react";

function TextInput() {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
  }, []);

  return <input ref={inputRef} type="text" />;
}
```

## Ref Forwarding with forwardRef

When you need to pass a ref through a component to a DOM node inside it:

```javascript
const FancyInput = React.forwardRef((props, ref) => (
  <input ref={ref} className="fancy-input" {...props} />
));

// Parent component
function Parent() {
  const inputRef = useRef(null);

  const handleClick = () => {
    inputRef.current.focus();
  };

  return (
    <>
      <FancyInput ref={inputRef} placeholder="Click the button to focus" />
      <button onClick={handleClick}>Focus</button>
    </>
  );
}
```

## useImperativeHandle: Exposing a Custom API

When the parent component should only have access to specific methods:

```javascript
const CustomInput = React.forwardRef((props, ref) => {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current.focus(),
    clear: () => {
      inputRef.current.value = "";
    },
    getValue: () => inputRef.current.value,
    // Only expose specific methods, not the entire DOM node
  }));

  return <input ref={inputRef} {...props} />;
});

// Parent can only call focus, clear, getValue
function Parent() {
  const inputRef = useRef(null);
  return (
    <>
      <CustomInput ref={inputRef} />
      <button onClick={() => inputRef.current.clear()}>Clear</button>
    </>
  );
}
```

Ref forwarding is mainly used for: focusing inputs in form libraries, integrating third-party imperative APIs, and building reusable component libraries that expose DOM methods.
