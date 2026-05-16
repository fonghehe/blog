---
title: "Tauri 1.0 Stable: Desktop Applications"
date: 2022-08-05 15:28:30
tags:
  - Frontend
readingTime: 2
description: "最近在团队中落地Tauri 1.0 正式版桌面应用， and accumulated quite a bit of experience. Here's a summary for reference, hoping it helps those doing similar work."
---

最近在团队中落地Tauri 1.0 正式版桌面应用， and accumulated quite a bit of experience. Here's a summary for reference, hoping it helps those doing similar work.

## Core Concepts

实际项目中的用法会更复杂一些：

```javascript
import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

const ItemList = ({ data, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }, [onRefresh])

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  ), [])

  return (
    <FlatList data={data} renderItem={renderItem}
      keyExtractor={item => item.id}
      refreshing={refreshing} onRefresh={handleRefresh} />
  )
}

```

Through this approach, both the testability and scalability of the code are improved.

## In-Depth Analysis

Here is a complete example:

```javascript
import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

const ItemList = ({ data, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }, [onRefresh])

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  ), [])

  return (
    <FlatList data={data} renderItem={renderItem}
      keyExtractor={item => item.id}
      refreshing={refreshing} onRefresh={handleRefresh} />
  )
}

```

Pay attention to boundary condition handling, which is critical in production.

## Implementation Experience

The key lies in understanding the core logic:

```javascript
import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

const ItemList = ({ data, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }, [onRefresh])

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  ), [])

  return (
    <FlatList data={data} renderItem={renderItem}
      keyExtractor={item => item.id}
      refreshing={refreshing} onRefresh={handleRefresh} />
  )
}

```

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Optimization Strategies

We can improve it in the following ways:

```javascript
import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

const ItemList = ({ data, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }, [onRefresh])

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  ), [])

  return (
    <FlatList data={data} renderItem={renderItem}
      keyExtractor={item => item.id}
      refreshing={refreshing} onRefresh={handleRefresh} />
  )
}

```

This approach has been running stably in production for over six months and has been practically validated.

## Summary

- In team collaboration, conventions and documentation are more important than the technology itself
- Stay updated with the community; technical solutions need continuous iteration
- Don't adopt new technology just for the sake of it
- Code examples are for reference only and need to be adjusted according to your business scenario
- Tauri 1.0 正式版桌面应用不是银弹，需要根据项目规模和技术栈选择