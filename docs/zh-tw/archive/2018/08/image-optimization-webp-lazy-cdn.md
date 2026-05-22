---
title: "前端圖片最佳化：WebP、懶載入與 CDN"
date: 2018-08-30 11:24:21
tags:
  - 效能最佳化
readingTime: 2
description: "圖片是網頁中最大的資源之一，通常佔總載入體積的 60% 以上。這篇文章彙總實際專案裡用過的圖片最佳化方法。"
wordCount: 297
---

圖片是網頁中最大的資源之一，通常佔總載入體積的 60% 以上。這篇文章彙總實際專案裡用過的圖片最佳化方法。

## WebP 格式

WebP 是 Google 開發的圖片格式，同等質量下比 JPEG 小 25-35%，比 PNG 小 26%。

**檢測瀏覽器支援並動態切換：**

```javascript
// 檢測 WebP 支援
function checkWebpSupport() {
  return new Promise((resolve) => {
    const webp = new Image();
    webp.onload = webp.onerror = () => resolve(webp.height === 2);
    webp.src =
      "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";
  });
}

// 在 index.js 最早執行
checkWebpSupport().then((supported) => {
  document.documentElement.classList.toggle("webp", supported);
});
```

```css
/* CSS 圖片 */
.hero {
  background-image: url("/images/hero.jpg");
}
.webp .hero {
  background-image: url("/images/hero.webp");
}
```

**HTML picture 元素（推薦）：**

```html
<picture>
  <source srcset="/images/hero.webp" type="image/webp" />
  <source srcset="/images/hero.jpg" type="image/jpeg" />
  <img src="/images/hero.jpg" alt="Hero Image" />
</picture>
```

瀏覽器從上到下選擇第一個支援的格式。

## 圖片懶載入

### 原生方案（新瀏覽器支援）

```html
<img loading="lazy" src="/images/photo.jpg" alt="Photo" />
```

但相容性還不夠好，主流方案是 `IntersectionObserver`：

```javascript
// 懶載入實現
class LazyLoader {
  constructor(selector = "img[data-src]") {
    this.images = document.querySelectorAll(selector);
    this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
      rootMargin: "200px 0px", // 提前 200px 開始載入
    });
    this.init();
  }

  init() {
    this.images.forEach((img) => this.observer.observe(img));
  }

  handleIntersect(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.loadImage(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    if (srcset) img.srcset = srcset;
    if (src) img.src = src;

    img.removeAttribute("data-src");
    img.removeAttribute("data-srcset");
    img.classList.add("loaded");
  }
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  new LazyLoader();
});
```

```html
<!-- 使用 data-src 替代 src -->
<img
  data-src="/images/photo.jpg"
  data-srcset="/images/photo@2x.jpg 2x"
  src="/images/placeholder.svg"
  alt="Photo"
  class="lazy"
/>
```

## 響應式圖片

根據裝置寬度載入不同尺寸的圖片：

```html
<!-- sizes 描述圖片顯示寬度，srcset 提供不同寬度的圖片 -->
<img
  src="/images/photo-400.jpg"
  srcset="
    /images/photo-400.jpg   400w,
    /images/photo-800.jpg   800w,
    /images/photo-1200.jpg 1200w
  "
  sizes="
    (max-width: 600px) 100vw,
    (max-width: 1200px) 50vw,
    33vw
  "
  alt="Responsive Photo"
/>
```

## CDN 與快取控製

圖片上傳到 CDN，配置合理的快取策略：

```nginx
# Nginx 設定：靜態資源強快取
location ~* \.(jpg|jpeg|png|gif|webp|svg)$ {
  expires 30d;
  add_header Cache-Control "public, immutable";
  add_header Vary Accept;
}
```

URL 帶 hash 避免快取問題：

```javascript
// webpack 配置：圖片檔名加 hash
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif|webp)$/,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: 8192, // 小於 8KB 轉 base64
              name: "images/[name].[hash:8].[ext]",
            },
          },
        ],
      },
    ],
  },
};
```

## 圖片壓縮

構建時自動壓縮：

```javascript
// webpack：imagemin-webpack-plugin
const ImageminPlugin = require("imagemin-webpack-plugin").default;

module.exports = {
  plugins: [
    new ImageminPlugin({
      test: /\.(jpe?g|png|gif|svg)$/i,
      pngquant: { quality: "65-90" },
      optipng: { optimizationLevel: 5 },
    }),
  ],
};
```

## 骨架屏與佔位

載入期間顯示低質量圖片（LQIP）：

```javascript
// 構建時生成極低質量的佔位圖（LQIP）
// tiny-lr、lqip-loader 等工具可以自動生成
{
  test: /\.(png|jpg)$/,
  use: [
    {
      loader: 'lqip-loader',
      options: { path: '/images', name: '[name].[hash:8].[ext]' }
    }
  ]
}
```

```jsx
{% raw %}
// React 元件：先顯示模糊佔位，載入完後漸顯清晰圖
function ProgressiveImage({ src, placeholder, alt }) {
  constructor(props) {
    super(props)
    this.state = { loaded: false }
  }

  render() {
    const { loaded } = this.state
    return (
      <div style={{ position: "relative" }}>
        <img src={this.props.placeholder} alt={this.props.alt} style={{ width: "100%" }} />
        <img
        src={src}
        alt={alt}
        style={{
          position: "absolute",
          inset: 0,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s",
        }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
{% endraw %}
```

## 小結

- WebP 同質量下體積小 30%，用 `<picture>` 漸進增強
- `IntersectionObserver` 實現精確的懶載入，提前 200px 觸發
- `srcset` + `sizes` 為不同螢幕提供合適的圖片
- 構建時用 imagemin 壓縮，CDN 配置 30 天強快取
- 小圖轉 base64，減少 HTTP 請求
