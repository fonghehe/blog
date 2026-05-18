---
title: "前端图片优化：WebP、懒加载与 CDN"
date: 2018-08-30 11:24:21
tags:
  - 性能优化
readingTime: 2
description: "图片是网页中最大的资源之一，通常占总加载体积的 60% 以上。这篇文章汇总实际项目里用过的图片优化方法。"
---

图片是网页中最大的资源之一，通常占总加载体积的 60% 以上。这篇文章汇总实际项目里用过的图片优化方法。

## WebP 格式

WebP 是 Google 开发的图片格式，同等质量下比 JPEG 小 25-35%，比 PNG 小 26%。

**检测浏览器支持并动态切换：**

```javascript
// 检测 WebP 支持
function checkWebpSupport() {
  return new Promise((resolve) => {
    const webp = new Image();
    webp.onload = webp.onerror = () => resolve(webp.height === 2);
    webp.src =
      "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";
  });
}

// 在 index.js 最早执行
checkWebpSupport().then((supported) => {
  document.documentElement.classList.toggle("webp", supported);
});
```

```css
/* CSS 图片 */
.hero {
  background-image: url("/images/hero.jpg");
}
.webp .hero {
  background-image: url("/images/hero.webp");
}
```

**HTML picture 元素（推荐）：**

```html
<picture>
  <source srcset="/images/hero.webp" type="image/webp" />
  <source srcset="/images/hero.jpg" type="image/jpeg" />
  <img src="/images/hero.jpg" alt="Hero Image" />
</picture>
```

浏览器从上到下选择第一个支持的格式。

## 图片懒加载

### 原生方案（新浏览器支持）

```html
<img loading="lazy" src="/images/photo.jpg" alt="Photo" />
```

但兼容性还不够好，主流方案是 `IntersectionObserver`：

```javascript
// 懒加载实现
class LazyLoader {
  constructor(selector = "img[data-src]") {
    this.images = document.querySelectorAll(selector);
    this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
      rootMargin: "200px 0px", // 提前 200px 开始加载
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

## 响应式图片

根据设备宽度加载不同尺寸的图片：

```html
<!-- sizes 描述图片显示宽度，srcset 提供不同宽度的图片 -->
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

## CDN 与缓存控制

图片上传到 CDN，配置合理的缓存策略：

```nginx
# Nginx 配置：静态资源强缓存
location ~* \.(jpg|jpeg|png|gif|webp|svg)$ {
  expires 30d;
  add_header Cache-Control "public, immutable";
  add_header Vary Accept;
}
```

URL 带 hash 避免缓存问题：

```javascript
// webpack 配置：图片文件名加 hash
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif|webp)$/,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: 8192, // 小于 8KB 转 base64
              name: "images/[name].[hash:8].[ext]",
            },
          },
        ],
      },
    ],
  },
};
```

## 图片压缩

构建时自动压缩：

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

## 骨架屏与占位

加载期间显示低质量图片（LQIP）：

```javascript
// 构建时生成极低质量的占位图（LQIP）
// tiny-lr、lqip-loader 等工具可以自动生成
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
// React 组件：先显示模糊占位，加载完后渐显清晰图
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

## 小结

- WebP 同质量下体积小 30%，用 `<picture>` 渐进增强
- `IntersectionObserver` 实现精确的懒加载，提前 200px 触发
- `srcset` + `sizes` 为不同屏幕提供合适的图片
- 构建时用 imagemin 压缩，CDN 配置 30 天强缓存
- 小图转 base64，减少 HTTP 请求
