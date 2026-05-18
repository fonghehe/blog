---
title: "Angular Universal 服务端渲染：SEO 与首屏优化完整指南"
date: 2021-08-20 17:22:10
tags:
  - Angular
  - TypeScript
readingTime: 2
description: "Angular Universal 让 Angular 应用可以在服务端预渲染 HTML，解决两个核心问题：SEO（搜索引擎抓取 SPA 困难）和首屏性能（FCP 指标优化）。Angular 12 的 Universal 已经相当成熟，这篇文章覆盖从集成到优化的完整流程。"
---

Angular Universal 让 Angular 应用可以在服务端预渲染 HTML，解决两个核心问题：SEO（搜索引擎抓取 SPA 困难）和首屏性能（FCP 指标优化）。Angular 12 的 Universal 已经相当成熟，这篇文章覆盖从集成到优化的完整流程。

## 快速集成

```bash
ng add @nguniversal/express-engine

# 生成的文件：
# ├── server.ts                  # Express 服务器
# ├── src/app/app.server.module.ts  # 服务端 AppModule
# └── src/main.server.ts         # 服务端入口
```

生成的 `server.ts` 开箱即用，无需大量配置：

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

## 服务端与浏览器环境的差异

SSR 最大的坑是：服务端没有 `window`、`document`、`localStorage` 等浏览器 API。

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

SSR 的典型问题：服务端已经请求了 API 数据，但客户端 hydration 时又请求一次。`TransferState` 解决这个问题：

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

## 构建和部署

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

**性能优化建议**：

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

如果页面内容是静态的（博客、文档），用预渲染（Prerendering）比 SSR 更简单：

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

预渲染产物是纯静态 HTML，可以直接部署到 CDN，无需 Node.js 服务器。

## 总结

Angular Universal 的集成成本在 Angular 12 已经相当低——`ng add` 一行命令就能搭好骨架。关键是要处理好平台差异（`isPlatformBrowser`）和 `TransferState` 数据传递。对内容型页面（博客、商品详情）来说，SSR 或预渲染带来的 SEO 和首屏性能提升非常可观。