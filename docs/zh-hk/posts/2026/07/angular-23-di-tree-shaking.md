---
title: "Angular 23 依賴注入與 Tree-shaking：編譯時優化的新方向"
date: 2026-07-24 16:38:26
tags:
  - Angular
readingTime: 7
description: "深入 Angular 23 編譯時依賴注入系統的工作原理、Tree-shakable providers 的實現機制，以及與 Vue/React 依賴注入方案的對比分析。"
wordCount: 2900
---

Angular 的依賴注入（DI）系統一直是其核心設計支柱。從 Angular 2 的運行時反射注入，到後來的 `providedIn` tree-shakable providers，再到 Angular 23 的編譯時 DI 增強，這個系統的演進方向越來越清晰：將儘可能多的工作從運行時移到編譯時，在保持開發體驗的同時縮小 bundle 體積。

## Angular 23 依賴注入系統演進

### 從運行時到編譯時

Angular 早期版本（2-15）的 DI 高度依賴運行時反射。`@Injectable()` 裝飾器和 `reflect-metadata` 在運行時通過 `design:paramtypes` 獲取構造函數參數類型，然後遞歸解析依賴。這種方案的代價是：

- 運行時反射開銷
- 無法被構建工具有效 tree-shake
- `Reflect.getMetadata` 的 polyfill 體積

Angular 23 引入了**編譯時 DI 解析**（Compile-time DI Resolution）。編譯器在構建階段就能確定依賴關係，生成直接的實例化代碼，而非運行時的依賴查找：

```typescript
// Angular 23 編譯時 DI
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
class UserRepository {
  private http = inject(HttpClient);

  getUser(id: string) {
    return this.http.get<User>(`/api/users/${id}`);
  }
}

// 編譯器生成的代碼（概念）
class UserRepository_Factory {
  static create() {
    // 直接引用，無運行時查找
    return new UserRepository(HttpClient_Factory.create());
  }
}
```

編譯器將 `inject()` 調用解析爲靜態依賴關係，生成不帶反射元數據的工廠函數。這使得未使用的 provider 可以被構建工具安全地移除。

### provide/inject 的類型安全增強

Angular 23 對 `provide` 和 `inject`（函數式 API）的類型推導做了顯著增強：

```typescript
import { provide, inject, InjectionToken } from '@angular/core';

// 類型安全的 token 定義
const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    baseUrl: '/api/v2',
    timeout: 5000,
    retryCount: 3,
  }),
});

// inject 的返回類型自動推導爲 ApiConfig
const config = inject(API_CONFIG);
//    ^? ApiConfig

// provide 函數式 API
const userService = provide(() => {
  const http = inject(HttpClient);
  const config = inject(API_CONFIG);

  return new UserService(http, config.baseUrl);
});
```

相比早期版本的字符串 token 和手動類型標註，這套 API 讓 DI 的類型安全達到了與手寫代碼一致的水平。類型錯誤在編譯階段就能捕獲，而非運行時拋出 `NullInjectorError`。

## Tree-shakable Providers 的實現原理

### providedIn 機制

Angular 的 `providedIn` 是 tree-shaking 的關鍵。傳統 DI 註冊方式（`providers: [UserService]`）將服務註冊到特定 injector，即使該服務從未被注入，也會被包含在 bundle 中：

```typescript
// 舊方式：無法 tree-shake
@NgModule({
  providers: [UserService, AuthService, LoggerService],
})
class AppModule {}
// 即使只有 UserService 被使用，三個服務都會進入 bundle
```

`providedIn: 'root'` 改變了這個模型。服務只有在被實際注入時，才會被包含到 bundle 中：

```typescript
// 新方式：tree-shakable
@Injectable({ providedIn: 'root' })
class UserService {
  // 只有被 inject(UserService) 引用時才進入 bundle
}
```

### 編譯器如何實現 Tree-shaking

Angular 編譯器對 `providedIn` 的處理分爲兩步：

1. **靜態分析**：編譯器掃描所有 `inject()` 調用和構造函數參數類型註解，構建依賴圖
2. **死代碼消除**：未被任何組件/指令/pipe 引用的 `@Injectable` 類，其工廠函數不會被生成到輸出中

```typescript
// 這個服務永遠不會進入 bundle，因爲沒有消費者
@Injectable({ providedIn: 'root' })
class UnusedService {
  constructor() {
    console.log('never called');
  }
}

// 這個服務會被包含，因爲被組件注入
@Injectable({ providedIn: 'root' })
class UsedService {
  getUser() { return { name: 'Alice' }; }
}

@Component({
  selector: 'app-user',
  template: '{{ user.name }}',
})
class UserComponent {
  private userService = inject(UsedService);
  user = this.userService.getUser();
}
```

Angular 23 的編譯器進一步優化了這一過程——它在編譯階段就能生成內聯的依賴實例化代碼，減少了運行時 injector 查找的開銷。

### 函數式 Provider 的 Tree-shaking

Angular 23 引入了更靈活的函數式 provider 語法：

```typescript
import { EnvironmentProviders, provide } from '@angular/core';

// 函數式 provider，天然 tree-shakable
function provideAuth(config: AuthConfig): EnvironmentProviders {
  return provide([
    provide(() => {
      const http = inject(HttpClient);
      return new AuthService(http, config);
    }),
    provide(() => {
      const auth = inject(AuthService);
      return new AuthInterceptor(auth);
    }),
  ]);
}

// 在應用配置中使用
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAuth({ baseUrl: '/api', storage: 'sessionStorage' }),
  ],
};
```

這種模式的優勢在於 provider 定義與 NgModule 解耦，構建工具可以更精確地分析依賴關係。

## Standalone Components 對 DI 的影響

Standalone components 徹底改變了 Angular 的模塊組織方式，也影響了 DI 的層級結構：

```typescript
// Standalone component 直接聲明依賴
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  template: `
    @for (product of products$ | async; track product.id) {
      <a [routerLink]="['/product', product.id]">{{ product.name }}</a>
    }
  `,
})
class ProductListComponent implements OnInit {
  private productService = inject(ProductService);
  products$!: Observable<Product[]>;

  ngOnInit() {
    this.products$ = this.productService.getProducts();
  }
}
```

Standalone components 消除了 NgModule 這個中間層，DI 的依賴關係更直接。編譯器可以更精確地分析哪些 provider 被實際使用，提高了 tree-shaking 的有效性。

### 局部 Provider 的精確控制

```typescript
// 在組件級別提供局部狀態
@Component({
  selector: 'app-editor',
  standalone: true,
  providers: [
    // 只有 EditorComponent 及其子組件可以注入這個實例
    provide(() => new EditorState()),
    provide(() => {
      const state = inject(EditorState);
      return new EditorCommandBus(state);
    }),
  ],
  template: `...`,
})
class EditorComponent {
  private commandBus = inject(EditorCommandBus);
}
```

## 與 Vue provide/inject 和 React Context 的對比

### Vue 的 provide/inject

Vue 的 DI 機制更輕量，本質是組件樹上的響應式數據傳遞：

```typescript
// Vue 3
import { provide, inject, ref, type InjectionKey } from 'vue';

const ThemeKey: InjectionKey<Ref<string>> = Symbol('theme');

// 父組件
const theme = ref('dark');
provide(ThemeKey, theme);

// 子組件
const theme = inject(ThemeKey);
if (theme) {
  console.log(theme.value); // 'dark'
}
```

Vue 的方案簡單但不具備 Angular DI 的以下能力：
- 無依賴解析器（不能自動解析構造函數依賴）
- 無 provider 層級覆蓋機制
- 無 tree-shaking 優化（因爲不是編譯時解析）

### React Context

React 的 Context API 是另一種方案：

```typescript
// React
import { createContext, useContext, type ReactNode } from 'react';

interface ThemeContextValue {
  theme: string;
  setTheme: (t: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

### 三者對比

| 特性 | Angular 23 DI | Vue provide/inject | React Context |
|------|--------------|--------------------|-------------- 
| 依賴解析 | 自動（構造函數/inject） | 手動 | 手動 |
| Tree-shaking | 編譯時支持 | 不支持 | 不支持 |
| 類型安全 | 強（編譯時推導） | 中（InjectionKey） | 中（createContext 泛型） |
| 層級覆蓋 | 支持（injector 樹） | 支持（就近原則） | 支持（嵌套 Provider） |
| 運行時開銷 | 低（編譯時優化） | 低 | 中（re-render） |
| 學習曲線 | 陡峭 | 平緩 | 平緩 |

Angular DI 的複雜性是其全面性的代價。對於大型企業應用，編譯時 DI 和 tree-shaking 帶來的 bundle 體積優化是實打實的收益；但對於中小型項目，Vue 和 React 的方案可能更務實。

## 大型項目中 DI 的層級管理

### Injector 樹與層級覆蓋

Angular 的 DI 系統形成一棵與組件樹平行的 injector 樹。每個組件可以有自己的 injector，查找依賴時會從當前組件向上逐級查找：

```typescript
// 根 injector 提供 UserService
@Injectable({ providedIn: 'root' })
class UserService {
  apiUrl = '/api/v1';
}

// 子組件覆蓋 UserService
@Component({
  selector: 'app-legacy',
  providers: [
    // 局部覆蓋，只影響此組件及其子組件
    { provide: UserService, useClass: LegacyUserService },
  ],
})
class LegacyComponent {
  constructor(private userService: UserService) {}
  // 這裡注入的是 LegacyUserService
}
```

### 多級 Injector 的性能影響

Injector 樹的查找是線性的。如果依賴鏈很深，且 provider 註冊在高層級，每次注入都要遍歷多個 injector。在性能敏感的場景中，應將 provider 註冊在儘可能接近用戶的層級：

```typescript
// 不理想：所有服務都在 root
@Injectable({ providedIn: 'root' })
class FeatureServiceA {}
@Injectable({ providedIn: 'root' })
class FeatureServiceB {}
@Injectable({ providedIn: 'root' })
class FeatureServiceC {}

// 更好：feature 級別提供
@Component({
  providers: [
    provide(() => new FeatureServiceA()),
    provide(() => new FeatureServiceB()),
    provide(() => {
      const a = inject(FeatureServiceA);
      const b = inject(FeatureServiceB);
      return new FeatureServiceC(a, b);
    }),
  ],
})
class FeatureContainer {}
```

### 懶加載與 DI

Angular 的懶加載模塊可以擁有自己的 root injector，實現服務隔離：

```typescript
// lazy-loaded route
const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.component'),
    providers: [
      // 這些 provider 只在 admin 路由下可用
      provide(() => new AdminGuardService()),
    ],
  },
];
```

Angular 23 優化了懶加載場景下的 DI——編譯器可以靜態分析路由配置，將懶加載模塊的 provider 打包到獨立 chunk 中，不影響主 bundle 體積。

## 最佳實踐和常見陷阱

### 1. 優先使用 inject() 函數

```typescript
// 推薦：函數式 inject
@Injectable({ providedIn: 'root' })
class OrderService {
  private http = inject(HttpClient);
  private store = inject(Store);
}

// 避免：構造函數注入（舊風格）
@Injectable({ providedIn: 'root' })
class OrderService {
  constructor(
    private http: HttpClient,
    private store: Store,
  ) {}
}
```

`inject()` 函數更利於編譯器靜態分析，且支持在構造函數之外的上下文中使用（如工廠函數）。

### 2. 避免循環依賴

```typescript
// 循環依賴：A 依賴 B，B 依賴 A
@Injectable({ providedIn: 'root' })
class ServiceA {
  constructor(private b: ServiceB) {} // 注入 B
}

@Injectable({ providedIn: 'root' })
class ServiceB {
  constructor(private a: ServiceA) {} // 注入 A → 循環！
}

// 修復：引入第三個服務打破循環
@Injectable({ providedIn: 'root' })
class SharedState {}

@Injectable({ providedIn: 'root' })
class ServiceA {
  constructor(private state: SharedState) {}
}

@Injectable({ providedIn: 'root' })
class ServiceB {
  constructor(private state: SharedState) {}
}
```

### 3. 使用 InjectionToken 配置外部依賴

```typescript
// 定義類型安全的配置 token
export const APP_FEATURE_FLAGS = new InjectionToken<FeatureFlags>(
  'APP_FEATURE_FLAGS',
  {
    providedIn: 'root',
    factory: () => {
      // 編譯時已知的默認值
      return {
        newDashboard: false,
        experimentalAPI: false,
      };
    },
  }
);

// 在測試中覆蓋
TestBed.configureTestingModule({
  providers: [
    {
      provide: APP_FEATURE_FLAGS,
      useValue: { newDashboard: true, experimentalAPI: false },
    },
  ],
});
```

### 4. 慎用 useClass 和 useFactory

`useClass` 和 `useFactory` 在 Angular 23 中仍然支持，但函數式 `provide()` 更利於 tree-shaking：

```typescript
// 舊方式
{ provide: AuthService, useClass: MockAuthService }

// 新方式（推薦）
provide(() => new MockAuthService())
```

### 5. 注意 providedIn 的作用域

```typescript
// providedIn: 'root' — 全局單例，tree-shakable
@Injectable({ providedIn: 'root' })
class GlobalConfig {}

// providedIn: 'platform' — 跨應用共享（微前端場景）
@Injectable({ providedIn: 'platform' })
class SharedAuthService {}

// providedIn: 'any' — 每個 lazy module 一個實例
@Injectable({ providedIn: 'any' })
class ModuleLocalService {}
```

## 小結

Angular 23 的 DI 系統代表了前端框架依賴注入的發展方向——從運行時反射走向編譯時解析，從模塊級註冊走向函數式 provider。這一演進的收益是雙重的：更小的 bundle 體積和更快的運行時性能。

與 Vue 和 React 的方案相比，Angular DI 的學習曲線確實更陡，但它在大型企業應用中的優勢是結構性的——類型安全、tree-shaking、層級覆蓋、懶加載隔離——這些能力在代碼庫規模擴大後會成爲關鍵的工程基礎設施。

當然，技術選型沒有銀彈。Angular DI 的全面性適合複雜的企業級應用，但對於中小型項目，Vue 的 `provide/inject` 或 React 的 Context 可能是更務實的選擇。理解每種方案的底層原理和權衡，才能做出正確的架構決策。
