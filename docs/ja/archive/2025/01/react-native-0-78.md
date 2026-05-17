---
title: "React Native 0.78：New Architecture正式安定版とHermes 0.15"
date: 2025-01-14 10:00:00
tags:
  - React
readingTime: 2
description: "React Native 0.78は2025年1月にリリースされ、New Architecture（Fabric + TurboModules）が正式に安定版（General Availability）に達しました。また、Hermes 0.15エンジンの統合、StyleSheetの静的抽出最適化など、パフォーマンスと互"
---

React Native 0.78は2025年1月にリリースされ、New Architecture（Fabric + TurboModules）が正式に安定版（General Availability）に達しました。また、Hermes 0.15エンジンの統合、StyleSheetの静的抽出最適化など、パフォーマンスと互換性の両面で大きな改善が含まれています。

## New Architecture：正式GA

React Native 0.76でNew Architectureがデフォルト有効になりましたが、0.78でついに「実験的」のラベルが完全に外れ、正式なGAとなりました。

```javascript
// react-native.config.js — 0.78 以降は newArchEnabled フラグが不要
// 0.76〜0.77 では明示的に有効化する必要があった
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  // 0.78 以降：New Architecture はデフォルトで有効、無効化オプションは非推奨
};
```

```typescript
// Fabric（新レンダラー）で書いたコンポーネントの例
// 0.78 以降、Fabric APIは安定
import { ViewProps } from "react-native";
import { HostComponent } from "react-native/Libraries/Renderer/shims/ReactNativeTypes";

// TurboModules：ネイティブモジュールの型安全な呼び出し
import { TurboModuleRegistry } from "react-native";

interface MyNativeModule extends TurboModule {
  multiply(a: number, b: number): Promise<number>;
  getSystemInfo(): Promise<{ os: string; version: string }>;
}

const MyNativeModule =
  TurboModuleRegistry.getEnforcing<MyNativeModule>("MyNativeModule");

// 型安全な呼び出し
const result = await MyNativeModule.multiply(3, 4); // → 12
```

## Hermes 0.15：JavaScriptエンジンの改善

```javascript
// Hermes 0.15 の主な改善
// 1. 初回起動時間の短縮（バイトコードキャッシュの改善）
// 2. Promise の実行効率向上
// 3. WeakRef と FinalizationRegistry のサポート

// WeakRef の使用例（Hermes 0.15 でサポート）
function useWeakRef<T extends object>(target: T) {
  const ref = useRef(new WeakRef(target));
  return {
    deref: () => ref.current.deref(),
  };
}

// FinalizationRegistry（リソースのクリーンアップ追跡）
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`オブジェクトが GC されました：${heldValue}`);
});

const obj = { data: "large data" };
registry.register(obj, "my-object");
```

## StyleSheetの静的抽出

React Native 0.78は`StyleSheet.create()`の静的抽出を改善し、JS→ネイティブのスタイル転送コストを削減しました。

```typescript
import { StyleSheet, View, Text } from "react-native";

// 0.78 以降：StyleSheet.create() のスタイルはビルド時に静的抽出され
// 実行時のスタイル計算コストが下がる
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  // 0.78 新機能：gap プロパティのサポート（React Native での Flexbox gap）
  row: {
    flexDirection: "row",
    gap: 12, // 以前は marginLeft/marginRight で代替していた
    alignItems: "center",
  },
});

function ProductCard({ product }: { product: Product }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{product.name}</Text>
      <View style={styles.row}>
        <PriceTag price={product.price} />
        <StockBadge stock={product.stock} />
      </View>
    </View>
  );
}
```

## React Native 0.78 へのアップグレード

```bash
# React Native アップグレードヘルパーを使用
npx react-native upgrade

# または手動でバージョンを更新
npm install react-native@0.78.0

# iOS の依存関係を更新
cd ios && pod install

# Android：gradle.properties の確認
# newArchEnabled=true（デフォルトになるが確認推奨）
```

### New Architecture への移行チェックリスト

```
1. ネイティブモジュールの確認：
   □ TurboModules API に対応しているか？
   □ コミュニティライブラリが 0.78 に対応しているか？（reactnative.directory で確認）

2. カスタムネイティブコンポーネントの確認：
   □ Fabric レンダラーに対応した ViewManager になっているか？
   □ レガシーの UIManager.dispatchViewManagerCommand() を使っていないか？

3. パフォーマンステスト：
   □ 起動時間が改善されているか？
   □ スクロールのFPS低下がないか？
   □ JavaScript Bridge の通信量が減っているか？（New Arch では JSI を使用）
```

## まとめ

React Native 0.78のNew Architecture GA達成は、モバイルReact開発にとって重要なマイルストーンです。JSI（JavaScript Interface）によるJavaScript↔ネイティブの同期通信、Fabricによる高性能なUIレンダリング、TurboModulesによる型安全なネイティブモジュール呼び出し——これらがついて本番品質として使えるようになりました。新規プロジェクトはNew Architectureをフルに活用した設計から始めることをお勧めします。
