---
title: "Angular Universal SSR: A Complete Guide to SEO and Initial Page Optimization"
date: 2021-08-20 17:22:10
tags:
  - Angular
  - TypeScript

readingTime: 2
description: "Angular Universal lets Angular apps pre-render HTML on the server, solving two core problems: SEO (crawlers struggle with SPAs) and first-paint performance (FCP). Universal in Angular 12 is quite mature — this article covers the full flow from integration to optimization."
wordCount: 219
---

Angular Universal lets Angular apps pre-render their HTML on the server, tackling two core problems: SEO (search engines struggle to crawl SPAs) and first-paint performance (improving the FCP metric). Universal in Angular 12 is already quite mature, and this article walks through the full workflow from integration to optimization.

## Quick Integration

```bash
ng add @nguniversal/express-engine

# 生成的文件：
# ├── server.ts                  # Express 服务器
# ├── src/app/app.server.module.ts  # 服务端 AppModule
# └── src/main.server.ts         # 服务端入口
```

The generated `server.ts` works out of the box and needs little configuration:

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

## Server vs Browser Environment Differences

The biggest pitfall with SSR is that the server has no browser APIs such as `window`, `document`, or `localStorage`.

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

## TransferState: Avoiding Duplicate Data Fetching

A classic SSR problem: the server has already fetched the API data, but the client fetches it again during hydration. `TransferState` solves this:

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

## Setting Meta Tags Dynamically (Critical for SEO)

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

## Build and Deployment

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

**Performance optimization tips:**

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

## SSR vs Prerendering

If a page's content is static (a blog or documentation), prerendering is simpler than SSR:

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

A prerendered output is plain static HTML that can be deployed straight to a CDN without needing a Node.js server.

## Summary

The integration cost of Angular Universal in Angular 12 is already quite low — a single `ng add` command scaffolds the skeleton. The key is handling the platform differences (`isPlatformBrowser`) and passing data via `TransferState`. For content-heavy pages (blogs, product details), the SEO and first-paint gains from SSR or prerendering are substantial.