---
title: "Frontend Image Format Comparison: WebP"
date: 2019-05-23 16:31:17
tags:
  - Frontend
readingTime: 1
description: "Choosing the right image format is a frequently encountered issue in frontend development. This article draws from real-world projects to share concrete impleme"
wordCount: 115
---

Choosing the right image format is a frequently encountered issue in frontend development. This article draws from real-world projects to share concrete implementation approaches and practical takeaways.

## Format Overview

| Format | Best For           | Compression      | Transparency | Animation |
| ------ | ------------------ | ---------------- | ------------ | --------- |
| JPEG   | Photos             | Lossy            | No           | No        |
| PNG    | Icons, screenshots | Lossless         | Yes          | No        |
| GIF    | Simple animations  | Lossless         | Yes          | Yes       |
| WebP   | Everything         | Both             | Yes          | Yes       |
| AVIF   | Everything         | Better than WebP | Yes          | Yes       |

## WebP

WebP, developed by Google, offers 25–34% smaller file sizes than JPEG at equivalent quality, and 26% smaller than PNG with transparency.

```html
<!-- Use <picture> for progressive enhancement -->
<picture>
  <source srcset="image.webp" type="image/webp" />
  <source srcset="image.jpg" type="image/jpeg" />
  <img src="image.jpg" alt="Description" />
</picture>
```

```javascript
// Detect WebP support
function supportsWebP() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0 && img.height > 0);
    img.onerror = () => resolve(false);
    img.src =
      "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
  });
}
```

## Responsive Images

```html
<!-- srcset: serve different sizes based on viewport -->
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 900px) 800px, 1200px"
  alt="Responsive image"
/>
```

## Build-Time Optimization

```javascript
// webpack: auto-convert to WebP with imagemin
const ImageMinimizerPlugin = require("image-minimizer-webpack-plugin");

module.exports = {
  plugins: [
    new ImageMinimizerPlugin({
      minimizerOptions: {
        plugins: [["imagemin-webp", { quality: 75 }]],
      },
    }),
  ],
};
```

The general rule: use WebP for photos and complex images, SVG for icons and illustrations, and always provide fallbacks for browsers that don't support WebP.
