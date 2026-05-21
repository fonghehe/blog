---
title: "Angular Universal 服務端渲染：SEO 與首屏最佳化完整指南"
date: 2021-08-20 17:22:10
tags:
  - Angular
  - TypeScript
readingTime: 2
description: "Angular Universal 讓 Angular 應用可以在服務端預渲染 HTML，解決兩個核心問題：SEO（搜尋引擎抓取 SPA 困難）和首屏效能（FCP 指標最佳化）。Angular 12 的 Universal 已經相當成熟，這篇文章覆蓋從整合到最佳化的完整流程。"
wordCount: 332
---

Angular Universal 讓 Angular 應用可以在服務端預渲染 HTML，解決兩個核心問題：SEO（搜尋引擎抓取 SPA 困難）和首屏效能（FCP 指標最佳化）。Angular 12 的 Universal 已經相當成熟，這篇文章覆蓋從整合到最佳化的完整流程。

## 快速整合

```bash
ng add @nguniversal/express-engine

# 生成的檔案：
# ├── server.ts                  # Express 伺服器
# ├── src/app/app.server.module.ts  # 服務端 AppModule
# └── src/main.server.ts         # 服務端入口
```

生成的 `server.ts` 開箱即用，無需大量配置：

```typescript
// server.ts（簡化版）
import { ngExpressEngine } from "@nguniversal/express-engine";
import { AppServerModule } from "./src/main.server";

const app = express();

app.engine("html", ngExpressEngine({ bootstrap: AppServerModule }));
app.set("view engine", "html");
app.set("views", distFolder);

// 靜態資源
app.get("*.*", express.static(distFolder, { maxAge: "1y" }));

// SSR 路由
app.get("*", (req, res) => res.render("index", { req }));
```

## 服務端與瀏覽器環境的差異

SSR 最大的坑是：服務端沒有 `window`、`document`、`localStorage` 等瀏覽器 API。

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
    return "light"; // 服務端預設值
  }

  setTheme(theme: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem("theme", theme);
    }
  }
}
```

## TransferState：避免雙重資料請求

SSR 的典型問題：服務端已經請求了 API 資料，但客戶端 hydration 時又請求一次。`TransferState` 解決這個問題：

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
    // 客戶端：先檢查 TransferState 快取
    if (isPlatformBrowser(this.platformId)) {
      const cached = this.transferState.get(USERS_KEY, null);
      if (cached) {
        this.transferState.remove(USERS_KEY);
        return of(cached); // 直接使用服務端傳來的資料，不重複請求
      }
    }

    return this.http.get<User[]>("/api/users").pipe(
      tap((users) => {
        // 服務端：將資料注入 TransferState，傳遞給客戶端
        if (isPlatformServer(this.platformId)) {
          this.transferState.set(USERS_KEY, users);
        }
      }),
    );
  }
}
```

## Meta 標籤動態設定（SEO 關鍵）

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

      // 設定頁面標題和 SEO meta 標籤
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

## 構建和部署

```bash
# 構建 SSR 版本
npm run build:ssr

# 本地測試
npm run serve:ssr

# 部署到 Node.js 伺服器
# dist/ 目錄包含：
# ├── browser/   # 客戶端靜態資源（CDN 可用）
# └── server/    # Node.js 伺服器程式碼
```

**效能最佳化建議**：

```typescript
// server.ts - 新增頁面快取
const cache = new Map<string, string>();

app.get("*", (req, res) => {
  const key = req.url;
  if (cache.has(key)) {
    return res.send(cache.get(key));
  }

  res.render("index", { req }, (err, html) => {
    if (!err) cache.set(key, html); // 快取渲染結果
    res.send(html);
  });
});
```

## SSR vs 預渲染

如果頁面內容是靜態的（部落格、文件），用預渲染（Prerendering）比 SSR 更簡單：

```bash
# 構建時預渲染指定路由
npm run prerender

# angular.json 配置預渲染路由
{
  "prerender": {
    "routes": ["/", "/about", "/blog/1", "/blog/2"]
  }
}
```

預渲染產物是純靜態 HTML，可以直接部署到 CDN，無需 Node.js 伺服器。

## 總結

Angular Universal 的整合成本在 Angular 12 已經相當低——`ng add` 一行命令就能搭好骨架。關鍵是要處理好平臺差異（`isPlatformBrowser`）和 `TransferState` 資料傳遞。對內容型頁面（部落格、商品詳情）來說，SSR 或預渲染帶來的 SEO 和首屏效能提升非常可觀。