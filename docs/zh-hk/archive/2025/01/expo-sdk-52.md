---
title: "Expo SDK 52 新特性：特性解讀與遷移建議"
date: 2025-01-22 12:16:53
tags:
  - 前端
readingTime: 3
description: "Expo SDK 52 基於 React Native 0.78 構建，主題是「原生能力民主化」——把以前需要 eject 才能用的功能變成零設定可用。新增的 Expo Modules API v3、Router v4、和 New Architecture 全面默認開啓是這個版本的三大支柱。"
wordCount: 470
---

Expo SDK 52 基於 React Native 0.78 構建，主題是「原生能力民主化」——把以前需要 eject 才能用的功能變成零設定可用。新增的 Expo Modules API v3、Router v4、和 New Architecture 全面默認開啓是這個版本的三大支柱。

## Expo Router v4：檔案路由的全面進化

Router v4 現在支持嵌套佈局、平行路由和攔截路由，API 設計參考了 Next.js App Router 但針對移動端做了適配。

```typescript
// app/_layout.tsx - 根佈局
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

// app/(tabs)/_layout.tsx - Tab 佈局
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="home"
        options={{
          title: '首頁',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '發現',
          tabBarIcon: ({ color }) => <Ionicons name="compass" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

// app/(tabs)/home/index.tsx
import { Link, useLocalSearchParams } from 'expo-router';

export default function HomeScreen() {
  return (
    <View>
      <Link href="/product/123" asChild>
        <TouchableOpacity>
          <Text>查看商品詳情</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
```

關鍵改進：路由預加載。用户在 Tab 之間切換時，目標頁面的 bundle 已經在後臺加載好了，切換延遲從 200ms 降到幾乎為零。

## Expo Modules API v3

v3 讓原生模塊開發變得像寫 React 組件一樣簡單。不再需要手寫 Swift/Kotlin 橋接代碼，用 TypeScript 聲明介面，Expo 自動生成。

```typescript
// modules/camera/index.ts
import { requireNativeModule } from 'expo';

interface CameraModule {
  takePictureAsync(options?: {
    quality?: number;
    flashMode?: 'auto' | 'on' | 'off';
  }): Promise<{ uri: string; width: number; height: number }>;

  startRecordingAsync(options?: {
    maxDuration?: number;
    quality?: '720p' | '1080p' | '4k';
  }): Promise<{ uri: string }>;

  stopRecordingAsync(): Promise<void>;

  requestPermissionsAsync(): Promise<{ granted: boolean }>;
}

export default requireNativeModule<CameraModule>('ExpoCamera');

// 使用
import Camera from '@/modules/camera';

function PhotoScreen() {
  const handleCapture = async () => {
    const { granted } = await Camera.requestPermissionsAsync();
    if (!granted) return;

    const photo = await Camera.takePictureAsync({
      quality: 0.9,
      flashMode: 'auto',
    });

    console.log(`照片: ${photo.uri}, ${photo.width}x${photo.height}`);
  };

  return <Button onPress={handleCapture} title="拍照" />;
}
```

v3 還支持原生 View 組件的自動生成。你可以用 TypeScript 聲明 props，自動生成 iOS UIView 和 Android View 的綁定代碼。

## EAS Build 改進：本地構建和緩存

EAS Build 現在支援本地構建模式，不再需要把代碼上傳到雲端：

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "cache": {
        "key": "sdk52-rn078",
        "paths": ["node_modules/**", ".expo/**"]
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "APP_ENV": "production"
      }
    }
  }
}
```

```bash
# 本地構建，不上傳代碼
eas build --platform ios --profile development --local

# 構建緩存命中率分析
eas build --profile production --cache-stats
# Output:
# node_modules: cache hit (142MB, saved 3m 20s)
# .expo: cache hit (8MB, saved 45s)
# Pods: cache miss (rebuilding)
```

## Expo Dev Tools 重新設計

SDK 52 的開發工具從 CLI 內置改為獨立應用，支持多設備同時調試：

```javascript
// app.config.js - 開發工具配置
export default {
  expo: {
    name: 'MyApp',
    plugins: [
      [
        'expo-dev-client',
        {
          // 啓用性能面板
          performanceMonitor: true,
          // 啓用網絡請求攔截
          networkInspector: true,
          // 自定義開發菜單
          devMenuItems: [
            {
              name: '清除緩存',
              action: () => DevMenu.reloadAsync({ purge: true }),
            },
          ],
        },
      ],
    ],
  },
};
```

新的 Dev Tools 直接顯示幀率曲線、內存趨勢、和網絡瀑布圖，不用再切換到 Xcode/Android Studio。

## 小結

- Expo Router v4 支持嵌套佈局和平行路由，路由預加載消除 Tab 切換延遲
- Modules API v3 用 TypeScript 聲明原生接口，自動生成 Swift/Kotlin 綁定
- EAS Build 支持本地構建，緩存策略可節省 70% 的構建時間
- Dev Tools 獨立應用支持多設備調試和性能監控
- Expo SDK 52 讓 React Native 開發體驗接近 Web，零 eject 即可訪問全部原生能力
