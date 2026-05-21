---
title: "React Native 1.0 穩定版"
date: 2026-01-29 10:00:00
tags:
  - React
readingTime: 3
description: "React Native 終於發佈了 1.0 正式版。從 2015 年的 0.x 到 2026 年的 1.0，這條路走了 11 年。新架構（New Architecture）完全默認啓用、Hermes 引擎成為唯一的 JS 引擎、以及 Fabric 渲染器的全面鋪開，標誌着 React Native 從\"能用\"走向了\""
wordCount: 371
---

React Native 終於發佈了 1.0 正式版。從 2015 年的 0.x 到 2026 年的 1.0，這條路走了 11 年。新架構（New Architecture）完全默認啓用、Hermes 引擎成為唯一的 JS 引擎、以及 Fabric 渲染器的全面鋪開，標誌着 React Native 從"能用"走向了"好用"。

## 新架構的全面啓用

New Architecture 不再是 opt-in，而是默認行為。這意味着 TurboModules、Fabric、Codegen 全部是開箱即用的。告別了舊架構的 bridge 序列化瓶頸。

```typescript
// native-module.ts —— 新架構下的原生模塊定義
// 使用 Codegen 自動生成類型安全的 JS-Native 綁定
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // 方法簽名由 Codegen 在構建時驗證
  // 不再有運行時的類型轉換開銷
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

// 自動註冊，不需要手動橋接
export default TurboModuleRegistry.getEnforcing<Spec>('DeviceManager');
```

```tsx
// 在 React 組件中使用 —— 完全類型安全
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

Fabric 是新的渲染架構，核心改進是同步佈局測量和併發渲染支持。在複雜列表和動畫場景下的性能提升非常明顯。

```tsx
// Fabric 帶來的能力：同步測量佈局
import { useRef, useCallback } from 'react';
import { View, Text, UIManager, findNodeHandle } from 'react-native';

function MeasureBeforeLayout() {
  const viewRef = useRef<View>(null);

  const handlePress = useCallback(() => {
    if (!viewRef.current) return;

    // Fabric 支持同步佈局測量，不需要異步回調
    const handle = findNodeHandle(viewRef.current);
    const measured = UIManager.measure(handle);

    console.log('同步測量結果:', {
      x: measured.x,
      y: measured.y,
      width: measured.width,
      height: measured.height,
    });
  }, []);

  return (
    <View ref={viewRef} onLayout={handlePress}>
      <Text>點擊測量</Text>
    </View>
  );
}

// Fabric 的併發渲染能力
import { useTransition, Suspense } from 'react';

function ProductScreen() {
  const [isPending, startTransition] = useTransition();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const handleFilterChange = (filter: string) => {
    // 低優先級更新：不阻塞用户交互
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

## Hermes 引擎的深度優化

Hermes 是唯一支持的 JS 引擎了。React Native 1.0 中的 Hermes 版本支持 ES2024 全部特性、BigInt、WeakRef、以及新的字節碼格式。

```typescript
// hermes.config.js
module.exports = {
  engine: 'hermes',
  hermes: {
    // 字節碼預編譯：啓動時間減少 40%
    bytecode: true,
    // ES2024 特性支持
    esversion: 2024,
    // 優化級別
    optimization: 'aggressive',
    // 啓用 Intl 支持（以前需要額外配置）
    intl: true,
    // 調試支持
    sourceMap: process.env.NODE_ENV !== 'production',
  },
};

// Hermes 1.0 支持的新能力
async function demonstrateHermesFeatures() {
  // BigInt 支持 —— 金額計算不再丟失精度
  const price = 999999999999999n;
  const tax = price * 13n / 100n;
  console.log(`價格: ${price}, 税額: ${tax}`);

  // WeakRef —— 大圖片緩存的內存管理
  const imageCache = new Map<string, WeakRef<ImageBitmap>>();
  function cacheImage(url: string, bitmap: ImageBitmap) {
    imageCache.set(url, new WeakRef(bitmap));
  }

  // FinalizationRegistry —— 清理過期緩存
  const registry = new FinalizationRegistry((url: string) => {
    imageCache.delete(url);
  });
}
```

## 跨平台 UI 一致性方案

React Native 1.0 對樣式系統做了大幅改進，特別是 Flexbox 的跨平台一致性和新的 StyleSheet 優化。

```tsx
// 跨平台一致的樣式方案
import { StyleSheet, Platform, useWindowDimensions } from 'react-native';

function ResponsiveLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  // 響應式佈局：手機單列，平板雙列，桌面三列
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;

  return (
    <FlatList
      data={products}
      numColumns={columns}
      key={columns} // 列數變化時重新渲染
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

## 小結

- React Native 1.0 的最大意義：穩定性承諾，API 不再有 breaking change
- New Architecture 全面默認，TurboModules 和 Fabric 帶來質的性能提升
- Hermes 成為唯一引擎，字節碼預編譯讓啓動時間減少 40%
- Fabric 的同步佈局測量和併發渲染讓複雜 UI 場景不再卡頓
- 跨平台一致性在 1.0 中終於達到了生產可用的標準
