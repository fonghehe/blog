---
title: "Expo SDK 52：Expo Router v4とモジュールAPIの刷新"
date: 2025-01-22 10:00:00
tags:
  - フロントエンド
readingTime: 3
description: "Expo SDK 52は2024年末にリリースされ、React Nativeエコシステム全体に多くの重要な更新をもたらしました。最も注目すべきは**Expo Router v4**のメジャーバージョンアップ、**Modules API v3**によるネイティブモジュール構築の簡素化、そして**EAS Build**（E"
---

Expo SDK 52は2024年末にリリースされ、React Nativeエコシステム全体に多くの重要な更新をもたらしました。最も注目すべきは**Expo Router v4**のメジャーバージョンアップ、**Modules API v3**によるネイティブモジュール構築の簡素化、そして**EAS Build**（Expo Application Services）のパフォーマンス改善です。本記事ではこれらのコア変更を詳しく見ていきます。

## Expo Router v4：サーバーコンポーネントとユニバーサルリンクの強化

Expo Router v4はReact NativeのコードをiOS、Android、Webで共有するファイルシステムルーターで、今回のアップデートで2つの大きな変更が加わりました。

### React Server Components のサポート（実験的）

```typescript
// app/products/[id]+api.ts — サーバー専用ルートハンドラー（v4 の新機能）
import { db } from "~/server/db";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const product = await db.product.findUnique({
    where: { id: params.id },
    include: { images: true, variants: true },
  });

  if (!product) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(product);
}

// app/products/[id].tsx — クライアントコンポーネント
import { useLocalSearchParams } from "expo-router";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // サーバールートハンドラーからデータを fetch
  const product = use(fetchProduct(id));

  return <ProductDetails product={product} />;
}
```

### ユニバーサルリンク処理の改善

```typescript
// app.json — Universal Links と App Links の統合設定
{
  "expo": {
    "scheme": "myapp",
    "ios": {
      "bundleIdentifier": "com.example.myapp",
      "associatedDomains": ["applinks:example.com"]
    },
    "android": {
      "package": "com.example.myapp",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "example.com" }]
        }
      ]
    }
  }
}
```

```typescript
// app/products/[id].tsx — ユニバーサルリンクの受け取り
import { useLocalSearchParams, useGlobalSearchParams } from "expo-router";

export default function ProductScreen() {
  // https://example.com/products/123 を受け取り → id = "123"
  const { id } = useLocalSearchParams<{ id: string }>();
  // ...
}
```

## Modules API v3：ネイティブモジュールのゼロボイラープレート

Expo Modules API v3は、React NativeのTurboModulesとFabricコンポーネントの設定コストを大幅に削減します。

```kotlin
// android/src/main/java/expo/modules/camera/CameraModule.kt
// Modules API v3 — ボイラープレートを大幅削減
package expo.modules.camera

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CameraModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoCamera")

    // v3 の新機能：Events 宣言が型安全になった
    Events("onCameraReady", "onBarCodeScanned", "onPictureSaved")

    // 非同期関数の定義
    AsyncFunction("takePictureAsync") { options: PictureOptions ->
      camera.takePicture(options)
    }

    // v3 の新機能：View Props の宣言型バインディング
    View(CameraView::class) {
      Prop("facing") { view: CameraView, facing: CameraFacing ->
        view.setFacing(facing)
      }

      OnViewDidUpdateProps { view ->
        view.applyPendingProps()
      }
    }
  }
}
```

```swift
// ios/CameraModule.swift
import ExpoModulesCore

public class CameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoCamera")

    Events("onCameraReady", "onBarCodeScanned", "onPictureSaved")

    AsyncFunction("takePictureAsync") { (options: PictureOptions) -> PictureResult in
      return try await self.camera.takePicture(with: options)
    }

    View(CameraView.self) {
      Prop("facing") { (view, facing: CameraFacing) in
        view.facing = facing
      }
    }
  }
}
```

## EAS Build の改善：ビルドキャッシュとCIの高速化

```yaml
# eas.json — キャッシュ設定の最適化
{
  "build":
    {
      "production":
        {
          "cache":
            {
              "key": "production-v1",
              ? // v3 の新機能：node_modules と CocoaPods のキャッシュを細分化
                "cacheDefaultPaths"
              : true,
              "customPaths":
                ["ios/Pods", "android/.gradle", "~/.gradle/caches"],
            },
        },
    },
}
```

```bash
# eas build でビルドキャッシュ効果を確認
eas build --platform ios --profile production

# ログ出力例（キャッシュヒット時）
# ✓ Cache restored (1.2 GB, saved 4m 30s)
# ✓ Build completed in 3m 45s (previous: 8m 15s)
```

## SDK 52へのアップグレード

```bash
# Expo CLI でバージョンアップ
npx expo install expo@52 --fix

# または手動でパッケージ更新
npm install expo@52.0.0

# 新 API への移行確認
npx expo-doctor

# 非推奨 API のチェック
npx expo install --check
```

## まとめ

Expo SDK 52は実験的なServer Componentsサポート、Modules API v3によるネイティブモジュール開発体験の改善、EAS Buildの高速化と合わせて、React Nativeプロジェクトにとって大きな前進をもたらします。特にモバイルとWebを同時に構築しているチームに Expo Router v4 はお勧めです。
