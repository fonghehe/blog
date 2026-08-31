---
title: "React SuspenseList: Loading Order Control"
date: 2020-03-24 16:02:13
tags:
  - React
readingTime: 2
description: "Our team recently adopted React SuspenseList for controlling load order and gained valuable experience. I'm writing this up as a reference for anyone doing similar work."
wordCount: 194
---

Recently our team got hands-on with React SuspenseList for controlling load order and accumulated quite a bit of experience. I'm writing it up as a reference, hoping it helps others doing similar work.

## Core Concepts

Building on this, we can optimize further:

```javascript
import { useReducer, useCallback } from 'react'

const initialState = { items: [], filter: '', sort: 'date' }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SET_FILTER': return { ...state, filter: action.payload }
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) }
    default: throw new Error(`Unknown: ${action.type}`)
  }
}

```

This pattern is very useful in large projects and significantly cuts maintenance cost.

## In-Depth Analysis

In real projects the usage gets a bit more complex:

```javascript
import { useReducer, useCallback } from 'react'

const initialState = { items: [], filter: '', sort: 'date' }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SET_FILTER': return { ...state, filter: action.payload }
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) }
    default: throw new Error(`Unknown: ${action.type}`)
  }
}

```

This approach improves both the testability and extensibility of the code.

## Implementation Experience

Here is a complete example:

```javascript
import { useReducer, useCallback } from 'react'

const initialState = { items: [], filter: '', sort: 'date' }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SET_FILTER': return { ...state, filter: action.payload }
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) }
    default: throw new Error(`Unknown: ${action.type}`)
  }
}

```

Pay attention to edge-case handling—it is critical in production.

## Tuning Strategies

The key is understanding the core logic:

```javascript
import { useReducer, useCallback } from 'react'

const initialState = { items: [], filter: '', sort: 'date' }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SET_FILTER': return { ...state, filter: action.payload }
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) }
    default: throw new Error(`Unknown: ${action.type}`)
  }
}

```

Performance optimization has to be tuned to the actual scenario—not everything needs over-optimization.

## Important Notes

We can improve it in the following ways:

```javascript
import { useReducer, useCallback } from 'react'

const initialState = { items: [], filter: '', sort: 'date' }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SET_FILTER': return { ...state, filter: action.payload }
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) }
    default: throw new Error(`Unknown: ${action.type}`)
  }
}

```

This approach has been running stably in production for over half a year and is proven in practice.

## Summary

- Don't adopt new tech just for its own sake.
- The code examples are for reference only; adapt them to your use case.
- React SuspenseList for controlling load order isn't a silver bullet—pick it based on project size and tech stack.
- Understanding the underlying principles matters more than memorizing APIs.
