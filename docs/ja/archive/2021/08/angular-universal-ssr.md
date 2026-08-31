---
title: "Angular Universal SSR：SEO とファーストビュー最適化の完全ガイド"
date: 2021-08-20 17:22:10
tags:
  - Angular
  - TypeScript

readingTime: 3
description: "Angular Universal 让 Angular 应用可以在服务端预渲染 HTML，解决两个核心问题：SEO（搜索引擎抓取 SPA 困难）和首屏性能（FCP 指标优化）。Angular 12 的 Universal 已经相当成熟，这篇文章覆盖从集成到优化的完整流程。"
wordCount: 573
---

Angular Universal を使うと、Angular アプリをサーバー側で事前レンダリングして HTML を生成できる。これにより 2 つの本質的な課題が解決する。すなわち、SEO（検索エンジンが SPA をクロールしにくい問題）と初回表示のパフォーマンス（FCP の指標改善）だ。Angular 12 の Universal はすでに十分に成熟しており、本記事では導入から最適化までの一連の流れを解説する。

## クイック統合

```bash
ng add @nguniversal/express-engine

# 生成的文件：
# ├── server.ts                  # Express 服务器
# ├── src/app/app.server.module.ts  # 服务端 AppModule
# └── src/main.server.ts         # 服务端入口
```

生成された `server.ts` はそのまま使えて、大量の設定は不要だ：

```typescript
// server.ts（简化版）
import { ngExpressEngine } from "@nguniversal/express-engine";
import { AppServerModule } from "./src/main.server";

const app = express();

app.engine("html", ngExpressEngine({ bootstrap: AppServerModule }));
app.set("view engine", "html");
app.set("views", distFolder);

// 静态资源
app.get("*.*", express.static(distFolder, { maxAge: "1y" }));

// SSR 路由
app.get("*", (req, res) => res.render("index", { req }));
```

## サーバーとブラウザ環境の違い

SSR 最大の落とし穴は、サーバー側には `window`、`document`、`localStorage` といったブラウザ API が存在しないことだ。

```typescript
import { isPlatformBrowser, isPlatformServer } from "@angular/common";
import { PLATFORM_ID } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ThemeService {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  getTheme(): string {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem("theme") || "light";
    }
    return "light"; // 服务端默认值
  }

  setTheme(theme: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem("theme", theme);
    }
  }
}
```

## TransferState：避免双重数据请求

SSR の典型的な問題は、サーバー側ですでに API データを取得しているのに、クライアントのハイドレーション時に再リクエストしてしまうことだ。`TransferState` がこの問題を解決する：

```typescript
import { TransferState, makeStateKey } from "@angular/platform-browser";

const USERS_KEY = makeStateKey<User[]>("users");

@Injectable({ providedIn: "root" })
export class UserService {
  constructor(
    private http: HttpClient,
    private transferState: TransferState,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  getUsers(): Observable<User[]> {
    // 客户端：先检查 TransferState 缓存
    if (isPlatformBrowser(this.platformId)) {
      const cached = this.transferState.get(USERS_KEY, null);
      if (cached) {
        this.transferState.remove(USERS_KEY);
        return of(cached); // 直接使用服务端传来的数据，不重复请求
      }
    }

    return this.http.get<User[]>("/api/users").pipe(
      tap((users) => {
        // 服务端：将数据注入 TransferState，传递给客户端
        if (isPlatformServer(this.platformId)) {
          this.transferState.set(USERS_KEY, users);
        }
      }),
    );
  }
}
```

## Meta 标签动态设置（SEO 关键）

```typescript
@Component({
  template: `<h1>{{ post.title }}</h1>
    <p>{{ post.content }}</p>`,
})
export class PostDetailComponent implements OnInit {
  post: Post;

  constructor(
    private route: ActivatedRoute,
    private meta: Meta,
    private title: Title,
  ) {}

  ngOnInit() {
    this.route.data.subscribe(({ post }) => {
      this.post = post;

      // 设置页面标题和 SEO meta 标签
      this.title.setTitle(post.title);
      this.meta.updateTag({ name: "description", content: post.excerpt });
      this.meta.updateTag({ property: "og:title", content: post.title });
      this.meta.updateTag({
        property: "og:description",
        content: post.excerpt,
      });
      this.meta.updateTag({ property: "og:image", content: post.coverImage });
    });
  }
}
```

## ビルドとデプロイ

```bash
# 构建 SSR 版本
npm run build:ssr

# 本地测试
npm run serve:ssr

# 部署到 Node.js 服务器
# dist/ 目录包含：
# ├── browser/   # 客户端静态资源（CDN 可用）
# └── server/    # Node.js 服务器代码
```

**パフォーマンス最適化のポイント**：

```typescript
// server.ts - 添加页面缓存
const cache = new Map<string, string>();

app.get("*", (req, res) => {
  const key = req.url;
  if (cache.has(key)) {
    return res.send(cache.get(key));
  }

  res.render("index", { req }, (err, html) => {
    if (!err) cache.set(key, html); // 缓存渲染结果
    res.send(html);
  });
});
```

## SSR vs 预渲染

ページの内容が静的（ブログやドキュメントなど）な場合、SSR よりもプリレンダリング（Prerendering）のほうがシンプルだ：

```bash
# 构建时预渲染指定路由
npm run prerender

# angular.json 配置预渲染路由
{
  "prerender": {
    "routes": ["/", "/about", "/blog/1", "/blog/2"]
  }
}
```

プリレンダリングの成果物は純粋な静的 HTML であり、Node.js サーバーなしでそのまま CDN にデプロイできる。

## まとめ

Angular 12 では Universal の導入コストはすでにかなり低い。`ng add` ひとつで雛形が組める。重要なのはプラットフォームの違い（`isPlatformBrowser`）と `TransferState` によるデータの受け渡しを適切に扱うことだ。ブログや商品詳細といったコンテンツ型のページであれば、SSR やプリレンダリングによる SEO と初回表示パフォーマンスの向上は非常に大きい。