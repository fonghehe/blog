---
title: "Angular 23 依存注入と Tree-shaking：コンパイル時最適化の新方向"
date: 2026-07-24 16:38:26
tags:
  - Angular
readingTime: 11
description: "Angular 23 のコンパイル時依存注入システムの仕組み、Tree-shakable providers の実装メカニズム、Vue/React の依存注入方案との比較分析を深く掘り下げる。"
wordCount: 2477
---

Angular の依存注入（DI）システムは常にその中核設計の柱であった。Angular 2 のランタイムリフレクション注入から、その後の `providedIn` による tree-shakable providers、そして Angular 23 のコンパイル時 DI 強化に至るまで、このシステムの進化の方向はますます明確になっている：可能な限り多くの作業をランタイムからコンパイル時に移し、開発体験を維持しながらバンドルサイズを縮小する。

## Angular 23 依存注入システムの進化

### ランタイムからコンパイル時へ

Angular 初期バージョン（2-15）の DI はランタイムリフレクションに強く依存していた。`@Injectable()` デコレータと `reflect-metadata` はランタイムで `design:paramtypes` を通じてコンストラクタ引数の型を取得し、再帰的に依存を解決していた。このアプローチの代償は：

- ランタイムリフレクションのオーバーヘッド
- ビルドツールによる効果的な tree-shaking が不可能
- `Reflect.getMetadata` の polyfill サイズ

Angular 23 は**コンパイル時 DI 解析**（Compile-time DI Resolution）を導入した。コンパイラがビルド段階で依存関係を確定し、ランタイムの依存検索ではなく直接的なインスタンス化コードを生成する：

```typescript
// Angular 23 コンパイル時 DI
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
class UserRepository {
  private http = inject(HttpClient);

  getUser(id: string) {
    return this.http.get<User>(`/api/users/${id}`);
  }
}

// コンパイラが生成するコード（概念）
class UserRepository_Factory {
  static create() {
    // 直接参照、ランタイム検索なし
    return new UserRepository(HttpClient_Factory.create());
  }
}
```

コンパイラは `inject()` 呼び出しを静的依存関係に解析し、リフレクションメタデータのないファクトリ関数を生成する。これにより未使用の provider はビルドツールによって安全に削除される。

### provide/inject の型安全性強化

Angular 23 は `provide` と `inject`（関数型 API）の型推導を大幅に強化した：

```typescript
import { provide, inject, InjectionToken } from '@angular/core';

// 型安全な token 定義
const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    baseUrl: '/api/v2',
    timeout: 5000,
    retryCount: 3,
  }),
});

// inject の戻り型が ApiConfig に自動推導される
const config = inject(API_CONFIG);
//    ^? ApiConfig

// provide 関数型 API
const userService = provide(() => {
  const http = inject(HttpClient);
  const config = inject(API_CONFIG);

  return new UserService(http, config.baseUrl);
});
```

初期バージョンの文字列 token と手動型アノテーションと比較して、この API は DI の型安全性を手書きコードと同等のレベルに引き上げた。型エラーはコンパイル段階で捕捉され、ランタイムで `NullInjectorError` がスローされることはない。

## Tree-shakable Providers の実装原理

### providedIn メカニズム

Angular の `providedIn` は tree-shaking の鍵である。従来の DI 登録方式（`providers: [UserService]`）はサービスを特定の injector に登録し、そのサービスが注入されなくてもバンドルに含まれる：

```typescript
// 旧方式：tree-shaking 不可
@NgModule({
  providers: [UserService, AuthService, LoggerService],
})
class AppModule {}
// UserService しか使用されなくても、3 つのサービスすべてがバンドルに入る
```

`providedIn: 'root'` がこのモデルを変えた。サービスは実際に注入された時にのみバンドルに含まれる：

```typescript
// 新方式：tree-shakable
@Injectable({ providedIn: 'root' })
class UserService {
  // inject(UserService) で参照された時のみバンドルに入る
}
```

### コンパイラによる Tree-shaking の実装

Angular コンパイラの `providedIn` の処理は二段階に分かれる：

1. **静的解析**：コンパイラがすべての `inject()` 呼び出しとコンストラクタ引数の型注釈をスキャンし、依存グラフを構築
2. **デッドコード除去**：どのコンポーネント/ディレクティブ/パイプからも参照されない `@Injectable` クラスのファクトリ関数は出力に生成されない

```typescript
// このサービスはバンドルに入らない、コンシューマーがいないため
@Injectable({ providedIn: 'root' })
class UnusedService {
  constructor() {
    console.log('never called');
  }
}

// このサービスはバンドルに含まれる、コンポーネントに注入されるため
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

Angular 23 のコンパイラはこのプロセスをさらに最適化した——コンパイル段階でインラインの依存インスタンス化コードを生成し、ランタイムの injector 検索オーバーヘッドを削減する。

### 関数型 Provider の Tree-shaking

Angular 23 はより柔軟な関数型 provider 構文を導入した：

```typescript
import { EnvironmentProviders, provide } from '@angular/core';

// 関数型 provider、天然 tree-shakable
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

// アプリケーション設定で使用
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAuth({ baseUrl: '/api', storage: 'sessionStorage' }),
  ],
};
```

このパターンの利点は provider 定義が NgModule から切り離されており、ビルドツールがより精密に依存関係を分析できることである。

## Standalone Components が DI に与える影響

Standalone components は Angular のモジュール組織方式を根本から変え、DI の階層構造にも影響を与えた：

```typescript
// Standalone component が直接依存を宣言
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

Standalone components は NgModule という中間層を排除し、DI の依存関係がより直接的になった。コンパイラはどの provider が実際に使用されているかをより精密に分析でき、tree-shaking の有効性が向上する。

### ローカル Provider の精密な制御

```typescript
// コンポーネントレベルでローカル状態を提供
@Component({
  selector: 'app-editor',
  standalone: true,
  providers: [
    // EditorComponent とその子コンポーネントのみがこのインスタンスを注入可能
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

## Vue provide/inject および React Context との比較

### Vue の provide/inject

Vue の DI メカニズムはより軽量で、本質はコンポーネントツリーを通じたリアクティブなデータの受け渡しにある：

```typescript
// Vue 3
import { provide, inject, ref, type InjectionKey } from 'vue';

const ThemeKey: InjectionKey<Ref<string>> = Symbol('theme');

// 親コンポーネント
const theme = ref('dark');
provide(ThemeKey, theme);

// 子コンポーネント
const theme = inject(ThemeKey);
if (theme) {
  console.log(theme.value); // 'dark'
}
```

Vue のアプローチはシンプルだが、Angular DI が持つ以下の能力を欠いている：
- 依存リゾルバなし（コンストラクタの依存を自動解決できない）
- provider 階層オーバーライド機構なし
- tree-shaking 最適化なし（コンパイル時解析ではないため）

### React Context

React の Context API はもう一つのアプローチである：

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

### 三者比較

| 特徴 | Angular 23 DI | Vue provide/inject | React Context |
|------|--------------|--------------------|--------------|
| 依存解決 | 自動（コンストラクタ/inject） | 手動 | 手動 |
| Tree-shaking | コンパイル時サポート | 非サポート | 非サポート |
| 型安全性 | 強（コンパイル時推導） | 中（InjectionKey） | 中（createContext ジェネリクス） |
| 階層オーバーライド | サポート（injector ツリー） | サポート（近接優先） | サポート（ネストされた Provider） |
| ランタイムオーバーヘッド | 低（コンパイル時最適化） | 低 | 中（再レンダー） |
| 学習曲線 | 急勾配 | 緩やか | 緩やか |

Angular DI の複雑さはその包括性の代償である。大規模なエンタープライズアプリケーションでは、コンパイル時 DI と tree-shaking によるバンドルサイズ最適化は確かなメリットとなる。一方、中小規模プロジェクトでは Vue と React のアプローチがより現実的かもしれない。

## 大規模プロジェクトにおける DI の階層管理

### Injector ツリーと階層オーバーライド

Angular の DI システムはコンポーネントツリーと並行する injector ツリーを形成する。各コンポーネントは独自の injector を持ち、依存を検索する際に現在のコンポーネントから上に向かって順次検索する：

```typescript
// ルート injector が UserService を提供
@Injectable({ providedIn: 'root' })
class UserService {
  apiUrl = '/api/v1';
}

// 子コンポーネントが UserService をオーバーライド
@Component({
  selector: 'app-legacy',
  providers: [
    // ローカルオーバーライド、このコンポーネントとその子にのみ影響
    { provide: UserService, useClass: LegacyUserService },
  ],
})
class LegacyComponent {
  constructor(private userService: UserService) {}
  // ここで注入されるのは LegacyUserService
}
```

### 多階層 Injector のパフォーマンス影響

Injector ツリーの検索は線形である。依存チェーンが深く、provider が高階層に登録されている場合、毎回の注入で複数の injector を走査する。パフォーマンスが重要な場面では、provider を使用者のできるだけ近い階層に登録すべきである：

```typescript
// 非理想的：すべてのサービスが root
@Injectable({ providedIn: 'root' })
class FeatureServiceA {}
@Injectable({ providedIn: 'root' })
class FeatureServiceB {}
@Injectable({ providedIn: 'root' })
class FeatureServiceC {}

// より良い：feature レベルで提供
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

### 遅延ロードと DI

Angular の遅延ロードモジュールは独自の root injector を持ち、サービスの分離を実現できる：

```typescript
// 遅延ロードルート
const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.component'),
    providers: [
      // これらの provider は admin ルートでのみ利用可能
      provide(() => new AdminGuardService()),
    ],
  },
];
```

Angular 23 は遅延ロードにおける DI を最適化した——コンパイラがルート設定を静的解析し、遅延ロードモジュールの provider を独立した chunk にパッケージ化でき、メインバンドルサイズに影響を与えない。

## ベストプラクティスとよくある落とし穴

### 1. inject() 関数を優先

```typescript
// 推奨：関数型 inject
@Injectable({ providedIn: 'root' })
class OrderService {
  private http = inject(HttpClient);
  private store = inject(Store);
}

// 避ける：コンストラクタ注入（旧スタイル）
@Injectable({ providedIn: 'root' })
class OrderService {
  constructor(
    private http: HttpClient,
    private store: Store,
  ) {}
}
```

`inject()` 関数はコンパイラの静的解析に有利であり、コンストラクタ外のコンテキスト（ファクトリ関数など）でも使用できる。

### 2. 循環依存を避ける

```typescript
// 循環依存：A は B に依存、B は A に依存
@Injectable({ providedIn: 'root' })
class ServiceA {
  constructor(private b: ServiceB) {} // B を注入
}

@Injectable({ providedIn: 'root' })
class ServiceB {
  constructor(private a: ServiceA) {} // A を注入 → 循環！
}

// 修正：第三のサービスを導入して循環を打破
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

### 3. InjectionToken で外部依存を設定

```typescript
// 型安全な設定 token の定義
export const APP_FEATURE_FLAGS = new InjectionToken<FeatureFlags>(
  'APP_FEATURE_FLAGS',
  {
    providedIn: 'root',
    factory: () => {
      // コンパイル時に既知のデフォルト値
      return {
        newDashboard: false,
        experimentalAPI: false,
      };
    },
  }
);

// テストでオーバーライド
TestBed.configureTestingModule({
  providers: [
    {
      provide: APP_FEATURE_FLAGS,
      useValue: { newDashboard: true, experimentalAPI: false },
    },
  ],
});
```

### 4. useClass と useFactory は慎重に使用

`useClass` と `useFactory` は Angular 23 でもサポートされているが、関数型 `provide()` の方が tree-shaking に有利である：

```typescript
// 旧方式
{ provide: AuthService, useClass: MockAuthService }

// 新方式（推奨）
provide(() => new MockAuthService())
```

### 5. providedIn のスコープに注意

```typescript
// providedIn: 'root' — グローバルシングルトン、tree-shakable
@Injectable({ providedIn: 'root' })
class GlobalConfig {}

// providedIn: 'platform' — アプリ間共有（マイクロフロントエンドシーン）
@Injectable({ providedIn: 'platform' })
class SharedAuthService {}

// providedIn: 'any' — 各遅延モジュールに一インスタンス
@Injectable({ providedIn: 'any' })
class ModuleLocalService {}
```

## まとめ

Angular 23 の DI システムはフロントエンドフレームワークの依存注入の進化の方向性を示している——ランタイムリフレクションからコンパイル時解析へ、モジュールレベル登録から関数型 provider へ。この進化のメリットは二重である：より小さなバンドルサイズとより高速なランタイムパフォーマンス。

Vue と React のアプローチと比較すると、Angular DI の学習曲線は確かに急であるが、大規模エンタープライズアプリケーションにおける優位性は構造的なものである——型安全性、tree-shaking、階層オーバーライド、遅延ロード分離——これらの能力はコードベースの規模が拡大した後に重要なエンジニアリングインフラとなる。

もちろん技術選択に銀の弾丸はない。Angular DI の包括性は複雑なエンタープライズ級アプリケーションに適するが、中小規模プロジェクトでは Vue の `provide/inject` や React の Context がより現実的な選択かもしれない。それぞれのアプローチの低レベルの原理とトレードオフを理解してこそ、正しいアーキテクチャの決断ができる。
