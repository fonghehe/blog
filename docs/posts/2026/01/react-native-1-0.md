---
title: "React Native 1.0 稳定版"
date: 2026-01-29 10:00:00
tags:
  - React
readingTime: 3
description: "React Native 终于发布了 1.0 正式版。从 2015 年的 0.x 到 2026 年的 1.0，这条路走了 11 年。新架构（New Architecture）完全默认启用、Hermes 引擎成为唯一的 JS 引擎、以及 Fabric 渲染器的全面铺开，标志着 React Native 从\"能用\"走向了\""
---

React Native 终于发布了 1.0 正式版。从 2015 年的 0.x 到 2026 年的 1.0，这条路走了 11 年。新架构（New Architecture）完全默认启用、Hermes 引擎成为唯一的 JS 引擎、以及 Fabric 渲染器的全面铺开，标志着 React Native 从"能用"走向了"好用"。

## 新架构的全面启用

New Architecture 不再是 opt-in，而是默认行为。这意味着 TurboModules、Fabric、Codegen 全部是开箱即用的。告别了旧架构的 bridge 序列化瓶颈。

```typescript
// native-module.ts —— 新架构下的原生模块定义
// 使用 Codegen 自动生成类型安全的 JS-Native 绑定
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // 方法签名由 Codegen 在构建时验证
  // 不再有运行时的类型转换开销
  getDeviceInfo(): Promise<{
    model: string;
    systemVersion: string;
    batteryLevel: number;
    isCharging: boolean;
  }>;

  startLocationTracking(
    accuracy: 'high' | 'balanced' | 'low',
    intervalMs: number
  ): Promise<void>;

  stopLocationTracking(): Promise<void>;
}

// 自动注册，不需要手动桥接
export default TurboModuleRegistry.getEnforcing<Spec>('DeviceManager');
```

```tsx
// 在 React 组件中使用 —— 完全类型安全
import { useEffect, useState } from 'react';
import DeviceManager from './native-module';

function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState<Awaited<
    ReturnType<Spec['getDeviceInfo']>
  > | null>(null);

  useEffect(() => {
    DeviceManager.getDeviceInfo().then(setDeviceInfo);
  }, []);

  return deviceInfo;
}

function DeviceDashboard() {
  const info = useDeviceInfo();

  if (!info) return <LoadingSpinner />;

  return (
    <View style={styles.card}>
      <Text style={styles.model}>{info.model}</Text>
      <Text>iOS {info.systemVersion}</Text>
      <BatteryIndicator
        level={info.batteryLevel}
        charging={info.isCharging}
      />
    </View>
  );
}
```

## Fabric 渲染器的性能收益

Fabric 是新的渲染架构，核心改进是同步布局测量和并发渲染支持。在复杂列表和动画场景下的性能提升非常明显。

```tsx
// Fabric 带来的能力：同步测量布局
import { useRef, useCallback } from 'react';
import { View, Text, UIManager, findNodeHandle } from 'react-native';

function MeasureBeforeLayout() {
  const viewRef = useRef<View>(null);

  const handlePress = useCallback(() => {
    if (!viewRef.current) return;

    // Fabric 支持同步布局测量，不需要异步回调
    const handle = findNodeHandle(viewRef.current);
    const measured = UIManager.measure(handle);

    console.log('同步测量结果:', {
      x: measured.x,
      y: measured.y,
      width: measured.width,
      height: measured.height,
    });
  }, []);

  return (
    <View ref={viewRef} onLayout={handlePress}>
      <Text>点击测量</Text>
    </View>
  );
}

// Fabric 的并发渲染能力
import { useTransition, Suspense } from 'react';

function ProductScreen() {
  const [isPending, startTransition] = useTransition();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const handleFilterChange = (filter: string) => {
    // 低优先级更新：不阻塞用户交互
    startTransition(() => {
      setSelectedFilter(filter);
    });
  };

  return (
    <View>
      <FilterBar
        onChange={handleFilterChange}
        loading={isPending}
      />
      <Suspense fallback={<ListSkeleton />}>
        <ProductList filter={selectedFilter} />
      </Suspense>
    </View>
  );
}
```

## Hermes 引擎的深度优化

Hermes 是唯一支持的 JS 引擎了。React Native 1.0 中的 Hermes 版本支持 ES2024 全部特性、BigInt、WeakRef、以及新的字节码格式。

```typescript
// hermes.config.js
module.exports = {
  engine: 'hermes',
  hermes: {
    // 字节码预编译：启动时间减少 40%
    bytecode: true,
    // ES2024 特性支持
    esversion: 2024,
    // 优化级别
    optimization: 'aggressive',
    // 启用 Intl 支持（以前需要额外配置）
    intl: true,
    // 调试支持
    sourceMap: process.env.NODE_ENV !== 'production',
  },
};

// Hermes 1.0 支持的新能力
async function demonstrateHermesFeatures() {
  // BigInt 支持 —— 金额计算不再丢失精度
  const price = 999999999999999n;
  const tax = price * 13n / 100n;
  console.log(`价格: ${price}, 税额: ${tax}`);

  // WeakRef —— 大图片缓存的内存管理
  const imageCache = new Map<string, WeakRef<ImageBitmap>>();
  function cacheImage(url: string, bitmap: ImageBitmap) {
    imageCache.set(url, new WeakRef(bitmap));
  }

  // FinalizationRegistry —— 清理过期缓存
  const registry = new FinalizationRegistry((url: string) => {
    imageCache.delete(url);
  });
}
```

## 跨平台 UI 一致性方案

React Native 1.0 对样式系统做了大幅改进，特别是 Flexbox 的跨平台一致性和新的 StyleSheet 优化。

```tsx
// 跨平台一致的样式方案
import { StyleSheet, Platform, useWindowDimensions } from 'react-native';

function ResponsiveLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  // 响应式布局：手机单列，平板双列，桌面三列
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;

  return (
    <FlatList
      data={products}
      numColumns={columns}
      key={columns} // 列数变化时重新渲染
      renderItem={({ item }) => (
        <View style={[styles.card, { flex: 1 / columns }]}>
          <ProductCard product={item} />
        </View>
      )}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    // React Native 1.0 的 gap 支持和 Web 完全一致
    borderRadius: 12,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
});
```

## 小结

- React Native 1.0 的最大意义：稳定性承诺，API 不再有 breaking change
- New Architecture 全面默认，TurboModules 和 Fabric 带来质的性能提升
- Hermes 成为唯一引擎，字节码预编译让启动时间减少 40%
- Fabric 的同步布局测量和并发渲染让复杂 UI 场景不再卡顿
- 跨平台一致性在 1.0 中终于达到了生产可用的标准
