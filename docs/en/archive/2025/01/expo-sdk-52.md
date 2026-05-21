---
title: "Expo SDK 52 New Features"
date: 2025-01-22 10:00:00
tags:
  - Frontend
readingTime: 3
description: "Expo SDK 52 is built on React Native 0.78, with the theme of \"democratizing native capabilities\" — turning features that previously required ejecting into zero-"
wordCount: 294
---

Expo SDK 52 is built on React Native 0.78, with the theme of "democratizing native capabilities" — turning features that previously required ejecting into zero-configuration options. The three pillars of this release are the new Expo Modules API v3, Router v4, and New Architecture enabled by default.

## Expo Router v4: Full Evolution of File-Based Routing

Router v4 now supports nested layouts, parallel routes, and intercepting routes. The API design draws inspiration from Next.js App Router but is adapted for mobile.

```typescript
// app/_layout.tsx - Root layout
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

// app/(tabs)/_layout.tsx - Tab layout
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="home"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '发现',
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
          <Text>查看商品详情</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
```

Key improvement: route prefetching. When users switch between Tabs, the bundle for the destination page is already loaded in the background, reducing switching latency from ~200ms to nearly zero.

## Expo Modules API v3

v3 makes native module development as simple as writing React components. No more hand-writing Swift/Kotlin bridge code — declare the interface in TypeScript and Expo generates it automatically.

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

// Usage
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

v3 also supports auto-generation of native View components. You can declare props in TypeScript, and the binding code for iOS UIView and Android View is generated automatically.

## EAS Build Improvements: Local Builds and Caching

EAS Build now supports local build mode, eliminating the need to upload code to the cloud:

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
# Local build, no code upload
eas build --platform ios --profile development --local

# Build cache hit rate analysis
eas build --profile production --cache-stats
# Output:
# node_modules: cache hit (142MB, saved 3m 20s)
# .expo: cache hit (8MB, saved 45s)
# Pods: cache miss (rebuilding)
```

## Expo Dev Tools Redesign

SDK 52's developer tools moved from being CLI-embedded to a standalone app, supporting simultaneous debugging across multiple devices:

```javascript
// app.config.js - Dev tools configuration
export default {
  expo: {
    name: "MyApp",
    plugins: [
      [
        "expo-dev-client",
        {
          // Enable performance panel
          performanceMonitor: true,
          // Enable network request interception
          networkInspector: true,
          // Custom dev menu
          devMenuItems: [
            {
              name: "清除缓存",
              action: () => DevMenu.reloadAsync({ purge: true }),
            },
          ],
        },
      ],
    ],
  },
};
```

The new Dev Tools directly displays frame rate curves, memory trends, and network waterfall charts, so you no longer need to switch to Xcode/Android Studio.

## Summary

- Expo Router v4 supports nested layouts and parallel routes; route prefetching eliminates Tab switching latency
- Modules API v3 lets you declare native interfaces in TypeScript with automatic Swift/Kotlin binding generation
- EAS Build supports local builds; caching strategies can save up to 70% of build time
- Standalone Dev Tools app supports multi-device debugging and performance monitoring
