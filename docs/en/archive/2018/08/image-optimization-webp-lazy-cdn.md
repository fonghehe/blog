---
title: "Frontend Image Optimization: WebP, Lazy Loading, and CDN"
date: 2018-08-30 11:24:21
tags:
  - Performance Optimization
readingTime: 2
description: "Images are among the largest resources on a webpage, often accounting for over 60% of total payload. This post collects image optimization techniques I've used "
wordCount: 139
---

Images are among the largest resources on a webpage, often accounting for over 60% of total payload. This post collects image optimization techniques I've used in real projects.

## WebP Format

WebP is an image format developed by Google that is 25-35% smaller than JPEG and 26% smaller than PNG at equivalent quality.

**Detect browser support and switch dynamically:**

```javascript
// Detect WebP support
function checkWebpSupport() {
  return new Promise((resolve) => {
    const webp = new Image();
    webp.onload = webp.onerror = () => resolve(webp.height === 2);
    webp.src =
      "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";
  });
}

// Execute as early as possible in index.js
checkWebpSupport().then((supported) => {
  document.documentElement.classList.toggle("webp", supported);
});
```

```css
/* CSS images */
.hero {
  background-image: url("/images/hero.jpg");
}
.webp .hero {
  background-image: url("/images/hero.webp");
}
```

**HTML picture element (recommended):**

```html
<picture>
  <source srcset="/images/hero.webp" type="image/webp" />
  <source srcset="/images/hero.jpg" type="image/jpeg" />
  <img src="/images/hero.jpg" alt="Hero Image" />
</picture>
```

The browser selects the first supported format from top to bottom.

## Image Lazy Loading

### Native Approach (Newer Browsers)

```html
<img loading="lazy" src="/images/photo.jpg" alt="Photo" />
```

Browser support isn't quite good enough yet; the mainstream approach is `IntersectionObserver`:

```javascript
// Lazy loading implementation
class LazyLoader {
  constructor(selector = "img[data-src]") {
    this.images = document.querySelectorAll(selector);
    this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
      rootMargin: "200px 0px", // start loading 200px early
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

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  new LazyLoader();
});
```

```html
<!-- Use data-src instead of src -->
<img
  data-src="/images/photo.jpg"
  data-srcset="/images/photo@2x.jpg 2x"
  src="/images/placeholder.svg"
  alt="Photo"
  class="lazy"
/>
```

## Responsive Images

Load different sizes based on device width:

```html
<!-- sizes describes display width, srcset provides images at different widths -->
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

## CDN and Cache Control

Upload images to CDN and configure proper cache policies:

```nginx
# Nginx: strong caching for static resources
location ~* \.(jpg|jpeg|png|gif|webp|svg)$ {
  expires 30d;
  add_header Cache-Control "public, immutable";
  add_header Vary Accept;
}
```

Add hash to URLs to avoid cache issues:

```javascript
// webpack config: add hash to image filenames
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif|webp)$/,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: 8192, // convert to base64 if smaller than 8KB
              name: "images/[name].[hash:8].[ext]",
            },
          },
        ],
      },
    ],
  },
};
```

## Image Compression

Automatically compress at build time:

```javascript
// webpack: imagemin-webpack-plugin
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

## Skeleton Screens and Placeholders

Display low-quality images (LQIP) while loading:
