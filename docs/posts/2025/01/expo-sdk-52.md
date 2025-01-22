---
title: "Expo SDK 52 新特性"
date: 2025-01-22 10:00:00
tags:
  - 前端
---

Expo SDK 52 基于 React Native 0.78 构建，主题是「原生能力民主化」——把以前需要 eject 才能用的功能变成零配置可用。新增的 Expo Modules API v3、Router v4、和 New Architecture 全面默认开启是这个版本的三大支柱。

## Expo Router v4：文件路由的全面进化

Router v4 现在支持嵌套布局、平行路由和拦截路由，API 设计参考了 Next.js App Router 但针对移动端做了适配。

```typescript
// app/_layout.tsx - 根布局
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

// app/(tabs)/_layout.tsx - Tab 布局
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

关键改进：路由预加载。用户在 Tab 之间切换时，目标页面的 bundle 已经在后台加载好了，切换延迟从 200ms 降到几乎为零。

## Expo Modules API v3

v3 让原生模块开发变得像写 React 组件一样简单。不再需要手写 Swift/Kotlin 桥接代码，用 TypeScript 声明接口，Expo 自动生成。

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

v3 还支持原生 View 组件的自动生成。你可以用 TypeScript 声明 props，自动生成 iOS UIView 和 Android View 的绑定代码。

## EAS Build 改进：本地构建和缓存

EAS Build 现在支持本地构建模式，不再需要把代码上传到云端：

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
# 本地构建，不上传代码
eas build --platform ios --profile development --local

# 构建缓存命中率分析
eas build --profile production --cache-stats
# Output:
# node_modules: cache hit (142MB, saved 3m 20s)
# .expo: cache hit (8MB, saved 45s)
# Pods: cache miss (rebuilding)
```

## Expo Dev Tools 重新设计

SDK 52 的开发工具从 CLI 内置改为独立应用，支持多设备同时调试：

```javascript
// app.config.js - 开发工具配置
export default {
  expo: {
    name: 'MyApp',
    plugins: [
      [
        'expo-dev-client',
        {
          // 启用性能面板
          performanceMonitor: true,
          // 启用网络请求拦截
          networkInspector: true,
          // 自定义开发菜单
          devMenuItems: [
            {
              name: '清除缓存',
              action: () => DevMenu.reloadAsync({ purge: true }),
            },
          ],
        },
      ],
    ],
  },
};
```

新的 Dev Tools 直接显示帧率曲线、内存趋势、和网络瀑布图，不用再切换到 Xcode/Android Studio。

## 小结

- Expo Router v4 支持嵌套布局和平行路由，路由预加载消除 Tab 切换延迟
- Modules API v3 用 TypeScript 声明原生接口，自动生成 Swift/Kotlin 绑定
- EAS Build 支持本地构建，缓存策略可节省 70% 的构建时间
- Dev Tools 独立应用支持多设备调试和性能监控
- Expo SDK 52 让 React Native 开发体验接近 Web，零 eject 即可访问全部原生能力
