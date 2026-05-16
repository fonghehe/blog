---
title: "Web Accessibility (a11y) Basics Every Frontend Developer Should Know"
date: 2019-05-26 10:51:45
tags:
  - Frontend
readingTime: 1
description: "Accessibility (a11y) is often overlooked in frontend development, but it's not just \"for blind people.\" Keyboard users, users with color blindness, and users wi"
---

Accessibility (a11y) is often overlooked in frontend development, but it's not just "for blind people." Keyboard users, users with color blindness, and users with temporary impairments (such as operating one-handed with a broken arm) all benefit from accessibility. As frontend developers, knowing the basics of a11y is part of professional competence.

## Why Frontend Developers Should Care About Accessibility

According to the World Health Organization, approximately 1 billion people worldwide have some form of disability. In web development:

- Users with visual impairments rely on **screen readers** (e.g., NVDA, VoiceOver) to "listen" to web pages
- Users with motor impairments rely on **keyboard navigation** rather than a mouse
- Users with color blindness cannot distinguish certain color combinations
- Users with cognitive disabilities need clear structure and guidance

Doing accessibility well not only serves these users but also improves the overall user experience and SEO.

## Semantic HTML Is the First Line of Defense

```html
<!-- Poor practice -->
<div class="header">
  <div class="nav">
    <span class="nav-item" onclick="goHome()">Home</span>
    <span class="nav-item" onclick="goAbout()">About</span>
  </div>
</div>
<div class="main">
  <div class="article">
    <span class="title">Article Title</span>
    <div>Article content...</div>
  </div>
</div>
<div class="footer">Copyright info</div>
```

```html
<!-- Good practice -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
</header>
<main>
  <article>
    <h1>Article Title</h1>
    <p>Article content...</p>
  </article>
</main>
<footer>
  <p>&copy; 2019 My Blog</p>
</footer>
```

Screen readers can use `<header>`, `<nav>`, `<main>`, `<article>`, `<footer>` to quickly navigate page structure.

## ARIA Attributes

```html
<!-- Roles -->
<div role="button" tabindex="0" onclick="handleClick()">Click me</div>

<!-- States and properties -->
<button aria-expanded="false" aria-controls="menu">Menu</button>
<ul id="menu" aria-hidden="true">
  <li><a href="/">Home</a></li>
</ul>

<!-- Labels -->
<input type="search" aria-label="Search articles" />
<img src="logo.png" alt="Company Logo" />
```

## Keyboard Navigation

```css
/* Never remove focus styles — keyboard users need them */
:focus {
  outline: 2px solid #409eff;
  outline-offset: 2px;
}

/* Or use a custom visible focus style */
:focus-visible {
  outline: 2px solid #409eff;
}
```

Start with semantic HTML, add ARIA only where semantics fall short, and always test with a keyboard — these three steps will get you 80% of the way to good accessibility.
