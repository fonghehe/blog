---
title: "React Native 1.0 穩定版"
date: 2026-01-29 18:03:40
tags:
  - React
readingTime: 3
description: "React Native 終於釋出了 1.0 正式版。從 2015 年的 0.x 到 2026 年的 1.0，這條路走了 11 年。新架構（New Architecture）完全預設啟用、Hermes 引擎成為唯一的 JS 引擎、以及 Fabric 渲染器的全面鋪開，標誌著 React Native 從\"能用\"走向了\""
wordCount: 375
---

React Native 終於釋出了 1.0 正式版。從 2015 年的 0.x 到 2026 年的 1.0，這條路走了 11 年。新架構（New Architecture）完全預設啟用、Hermes 引擎成為唯一的 JS 引擎、以及 Fabric 渲染器的全面鋪開，標誌著 React Native 從"能用"走向了"好用"。

## 新架構的全面啟用

New Architecture 不再是 opt-in，而是預設行為。這意味著 TurboModules、Fabric、Codegen 全部是開箱即用的。告別了舊架構的 bridge 序列化瓶頸。

```typescript
// native-module.ts —— 新架構下的原生模組定義
// 使用 Codegen 自動生成型別安全的 JS-Native 繫結
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // 方法簽名由 Codegen 在構建時驗證
  // 不再有執行時的型別轉換開銷
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
// 在 React 元件中使用 —— 完全型別安全
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

## Fabric 渲染器的效能收益

Fabric 是新的渲染架構，核心改進是同步佈局測量和併發渲染支援。在複雜列表和動畫場景下的效能提升非常明顯。

```tsx
// Fabric 帶來的能力：同步測量佈局
import { useRef, useCallback } from 'react';
import { View, Text, UIManager, findNodeHandle } from 'react-native';

function MeasureBeforeLayout() {
  const viewRef = useRef<View>(null);

  const handlePress = useCallback(() => {
    if (!viewRef.current) return;

    // Fabric 支援同步佈局測量，不需要非同步回撥
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
      <Text>點選測量</Text>
    </View>
  );
}

// Fabric 的併發渲染能力
import { useTransition, Suspense } from 'react';

function ProductScreen() {
  const [isPending, startTransition] = useTransition();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const handleFilterChange = (filter: string) => {
    // 低優先順序更新：不阻塞使用者互動
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

## Hermes 引擎的深度最佳化

Hermes 是唯一支援的 JS 引擎了。React Native 1.0 中的 Hermes 版本支援 ES2024 全部特性、BigInt、WeakRef、以及新的位元組碼格式。

```typescript
// hermes.config.js
module.exports = {
  engine: 'hermes',
  hermes: {
    // 位元組碼預編譯：啟動時間減少 40%
    bytecode: true,
    // ES2024 特性支援
    esversion: 2024,
    // 最佳化級別
    optimization: 'aggressive',
    // 啟用 Intl 支援（以前需要額外設定）
    intl: true,
    // 除錯支援
    sourceMap: process.env.NODE_ENV !== 'production',
  },
};

// Hermes 1.0 支援的新能力
async function demonstrateHermesFeatures() {
  // BigInt 支援 —— 金額計算不再丟失精度
  const price = 999999999999999n;
  const tax = price * 13n / 100n;
  console.log(`價格: ${price}, 稅額: ${tax}`);

  // WeakRef —— 大圖片快取的記憶體管理
  const imageCache = new Map<string, WeakRef<ImageBitmap>>();
  function cacheImage(url: string, bitmap: ImageBitmap) {
    imageCache.set(url, new WeakRef(bitmap));
  }

  // FinalizationRegistry —— 清理過期快取
  const registry = new FinalizationRegistry((url: string) => {
    imageCache.delete(url);
  });
}
```

## 跨平臺 UI 一致性方案

React Native 1.0 對樣式系統做了大幅改進，特別是 Flexbox 的跨平臺一致性和新的 StyleSheet 最佳化。

```tsx
// 跨平臺一致的樣式方案
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
    // React Native 1.0 的 gap 支援和 Web 完全一致
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
- New Architecture 全面預設，TurboModules 和 Fabric 帶來質的效能提升
- Hermes 成為唯一引擎，位元組碼預編譯讓啟動時間減少 40%
- Fabric 的同步佈局測量和併發渲染讓複雜 UI 場景不再卡頓
- 跨平臺一致性在 1.0 中終於達到了生產可用的標準
