---
title: "2020 Year-End Retrospective: Growth Amid Chaos"
date: 2020-12-30 14:36:05
tags:
  - Frontend
readingTime: 2
description: "A year-end retrospective of 2020, reflecting on a year defined by pandemic, lockdown, and uncertainty alongside significant technical breakthroughs."
wordCount: 398
---

2020 was the year everything changed. A pandemic, lockdown, uncertainty — and yet it was also a year of technical breakthroughs.

## Technically

**Vue 3 stable release**

After more than a year of waiting, it finally arrived. Once it shipped in September, our internal greenfield projects moved to Vue 3 + Vite. The developer experience is far better than Vue 2 + Webpack — especially startup speed.

Once you get used to the Composition API, it really clicks — logic reuse is clean and TypeScript support is solid. But the ecosystem still isn't complete: Element Plus is still in beta, and we hit quite a few rough edges with some community component libraries.

**Vite 1.0**

Released in December; we've decided to adopt it wholesale on the next project. Goodbye 60-second startup.

**Adapting to remote work**

I started working from home in March, and it's been nine months now. I gradually accepted remote work and optimized how I do it:

- Async-first communication, fewer pointless meetings
- Docs before code, more careful code reviews
- Actually more focused time than in the office

**Technologies I went deep on**

- Vue 3 Composition API source code
- React Concurrent Mode (still waiting for the stable release)
- How Vite's ESM works under the hood
- A frontend monitoring system (built a simple in-house one)

## What I Didn't Finish in 2020

- Algorithm practice: planned three problems a week, actually averaged about five a month 😅
- Open source: filed a few issues, but no substantial PRs
- Tech talks: gave 3 internal talks, planned 6

## The Most Impactful Thing

Being forced to go fully async and remote made me realize:

**Writing matters for engineers.**

Face-to-face communication is cheap — you can fill in gaps with tone and body language. Written communication has none of that, so you have to state things clearly. This year I wrote more technical docs and design docs, and communication quality actually improved.

## 2021 Plans

Technically:

- Go deep on React 18's new features (Concurrent Mode should be stable by then)
- Put Vite 2 into production
- Study algorithms systematically (for real this time — one problem a day)
- Start reading English tech books (SICP)

Engineering:

- Build the team's frontend monitoring system
- Drive component-library development

Personally:

- Blog at least 4 posts a month (no more gaps)
- Exercise (sitting all day at home is terrible)

2020 passed in chaos, but chaos is also fertile soil for growth. Onward to 2021.
