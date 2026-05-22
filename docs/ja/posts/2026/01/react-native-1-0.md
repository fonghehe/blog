---
title: "React Native 1.0 安定版"
date: 2026-01-29 18:03:40
tags:
  - React
readingTime: 4
description: "React Nativeがついに1.0正式版をリリースしました。2015年の0.xから2026年の1.0まで、この道のりは11年かかりました。新アーキテクチャ（New Architecture）が完全にデフォルト有効化され、HermesエンジンがサポートされるJS唯一のエンジンとなり、Fabricレンダラーが全面展開さ"
wordCount: 642
---

React Nativeがついに1.0正式版をリリースしました。2015年の0.xから2026年の1.0まで、この道のりは11年かかりました。新アーキテクチャ（New Architecture）が完全にデフォルト有効化され、HermesエンジンがサポートされるJS唯一のエンジンとなり、Fabricレンダラーが全面展開されたことは、React Nativeが「使えるもの」から「本当に良いもの」へと進化したことを示しています。

## 新アーキテクチャの全面有効化

New Architectureはもはやオプトインではなく、デフォルトの動作です。つまりTurboModules、Fabric、Codegenがすべて最初から使えます。旧アーキテクチャのbridgeシリアライズのボトルネックとはお別れです。

```typescript
// native-module.ts —— 新アーキテクチャ下でのネイティブモジュール定義
// Codegenを使ってビルド時に型安全なJS-Nativeバインディングを自動生成する
import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  // メソッドシグネチャはビルド時にCodegenで検証される
  // 実行時の型変換オーバーヘッドがなくなった
  getDeviceInfo(): Promise<{
    model: string;
    systemVersion: string;
    batteryLevel: number;
    isCharging: boolean;
  }>;

  startLocationTracking(
    accuracy: "high" | "balanced" | "low",
    intervalMs: number,
  ): Promise<void>;

  stopLocationTracking(): Promise<void>;
}

// 自動登録、手動ブリッジ不要
export default TurboModuleRegistry.getEnforcing<Spec>("DeviceManager");
```

```tsx
// Reactコンポーネントでの使用 —— 完全な型安全性
import { useEffect, useState } from "react";
import DeviceManager from "./native-module";

function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState<Awaited<
    ReturnType<Spec["getDeviceInfo"]>
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
      <BatteryIndicator level={info.batteryLevel} charging={info.isCharging} />
    </View>
  );
}
```

## Fabricレンダラーのパフォーマンス向上

Fabricは新しいレンダリングアーキテクチャです。核心的な改善は同期的なレイアウト測定と並行レンダリングのサポートです。複雑なリストとアニメーションのシナリオでのパフォーマンス改善は非常に顕著です。

```tsx
// Fabricが提供する能力：同期的なレイアウト測定
import { useRef, useCallback } from "react";
import { View, Text, UIManager, findNodeHandle } from "react-native";

function MeasureBeforeLayout() {
  const viewRef = useRef<View>(null);

  const handlePress = useCallback(() => {
    if (!viewRef.current) return;

    // Fabricは同期的なレイアウト測定をサポート——非同期コールバック不要
    const handle = findNodeHandle(viewRef.current);
    const measured = UIManager.measure(handle);

    console.log("同期測定結果:", {
      x: measured.x,
      y: measured.y,
      width: measured.width,
      height: measured.height,
    });
  }, []);

  return (
    <View ref={viewRef} onLayout={handlePress}>
      <Text>タップして測定</Text>
    </View>
  );
}

// Fabricの並行レンダリング能力
import { useTransition, Suspense } from "react";

function ProductScreen() {
  const [isPending, startTransition] = useTransition();
  const [selectedFilter, setSelectedFilter] = useState("all");

  const handleFilterChange = (filter: string) => {
    // 低優先度の更新：ユーザーのインタラクションをブロックしない
    startTransition(() => {
      setSelectedFilter(filter);
    });
  };

  return (
    <View>
      <FilterBar onChange={handleFilterChange} loading={isPending} />
      <Suspense fallback={<ListSkeleton />}>
        <ProductList filter={selectedFilter} />
      </Suspense>
    </View>
  );
}
```

## Hermesエンジンの深い最適化

HermesはサポートされるJS唯一のエンジンになりました。React Native 1.0のHermesバージョンはES2024のすべての機能、BigInt、WeakRef、そして新しいバイトコードフォーマットをサポートします。

```typescript
// hermes.config.js
module.exports = {
  engine: "hermes",
  hermes: {
    // バイトコード事前コンパイル：起動時間を40%削減
    bytecode: true,
    // ES2024機能サポート
    esversion: 2024,
    // 最適化レベル
    optimization: "aggressive",
    // Intlサポートを有効化（以前は追加設定が必要だった）
    intl: true,
    // デバッグサポート
    sourceMap: process.env.NODE_ENV !== "production",
  },
};

// Hermes 1.0でサポートされる新機能
async function demonstrateHermesFeatures() {
  // BigIntサポート——金額計算で精度が失われなくなった
  const price = 999999999999999n;
  const tax = (price * 13n) / 100n;
  console.log(`価格: ${price}, 税額: ${tax}`);

  // WeakRef——大きな画像キャッシュのメモリ管理
  const imageCache = new Map<string, WeakRef<ImageBitmap>>();
  function cacheImage(url: string, bitmap: ImageBitmap) {
    imageCache.set(url, new WeakRef(bitmap));
  }

  // FinalizationRegistry——期限切れキャッシュのクリーンアップ
  const registry = new FinalizationRegistry((url: string) => {
    imageCache.delete(url);
  });
}
```

## クロスプラットフォームUIの一貫性

React Native 1.0はスタイルシステムに大幅な改善をもたらしました。特にFlexboxのクロスプラットフォーム一貫性と新しいStyleSheet最適化が重要です。

```tsx
// クロスプラットフォームで一貫したスタイルアプローチ
import { StyleSheet, Platform, useWindowDimensions } from "react-native";

function ResponsiveLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  // レスポンシブレイアウト：スマートフォンは1列、タブレットは2列、デスクトップは3列
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;

  return (
    <FlatList
      data={products}
      numColumns={columns}
      key={columns} // 列数が変わったときに再レンダリングする
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
    // React Native 1.0のgapサポートはWebと完全に一致する
    borderRadius: 12,
    backgroundColor: "#fff",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      },
    }),
  },
});
```

## まとめ

- React Native 1.0の最大の意義：安定性の約束——APIのbreaking changeはもうない
- New Architectureが完全にデフォルト有効化され、TurboModulesとFabricが質的なパフォーマンス向上をもたらす
- Hermesが唯一のエンジンになり、バイトコード事前コンパイルで起動時間が40%削減される
- Fabricの同期レイアウト測定と並行レンダリングで複雑なUIシナリオでのカクつきがなくなる
- クロスプラットフォームの一貫性が1.0でついにプロダクション投入可能な基準に達した
