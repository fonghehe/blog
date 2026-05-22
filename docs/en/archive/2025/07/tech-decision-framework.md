---
title: "A Tech Decision Framework: How to Make Technical Choices for Your Team"
date: 2025-07-10 17:04:41
tags:
  - Frontend
readingTime: 2
description: "After years as a tech lead, what bothers me most isn't writing code — it's technology selection. Here's my decision-making framework."
wordCount: 347
---

After years as a tech lead, what bothers me most isn't writing code — it's technology selection. Here's my decision-making framework.

## Why Tech Selection Is Hard

```
Surface reason: Too many options, each with pros and cons
Root cause: No unified evaluation dimensions, hidden constraints left unaddressed

For example:
PM says: Hurry up, we need to ship next week
Manager says: Use mature tech, don't cause problems
Team: Can we use that new framework I've been learning?
You: ...
```

## The Decision Matrix

I like using a 5-dimension matrix for evaluation:

```
1. Team Familiarity
   Existing experience? How steep is the learning curve?

2. Maturity
   Community size? Issue response speed? Is a company maintaining it?

3. Fit
   How well does the problem it solves match our problem?

4. Migration Cost
   If we switch in the future, how costly is it? (lock-in risk)

5. Operational Cost
   How complex is maintenance after going live?
```

Real scoring example (selecting state management for a new project):

|                  | Zustand | Jotai  | Redux Toolkit | Valtio |
| ---------------- | ------- | ------ | ------------- | ------ |
| Team Familiarity | 3       | 1      | 4             | 1      |
| Maturity         | 4       | 3      | 5             | 3      |
| Fit              | 5       | 4      | 3             | 4      |
| Migration Cost   | 5       | 4      | 3             | 4      |
| Operational Cost | 5       | 4      | 3             | 4      |
| **Total**        | **22**  | **16** | **18**        | **16** |

Final choice: Zustand — best fit, team has some experience, easy to migrate.

## Common Anti-Patterns

**"This library has the most GitHub Stars"**

Star count doesn't mean it fits your use case. `moment.js` has 40k stars, but it's too heavy; now people use `dayjs` or the native `Temporal`.

**"Big companies are using this"**

Big-company scenarios are not your scenarios. They have 1000 engineers maintaining that solution; you have 5.

**"New tech is more advanced"**

Newest ≠ best. The question is: which specific problem you currently face does it solve?

**"Let's just try it out first"**

"Try it out" often becomes "I guess we're stuck with it." POCs need clear evaluation criteria; otherwise, it's easy to fall into the sunk-cost trap.

## RFC Documents

Our team now writes an RFC (Request for Comments) for every significant technical decision:

```markdown
# RFC: State Management Selection

## Background

The current project...has the following issues...

## Goals

- Unify state management approach
- Reduce boilerplate code
- Improve TypeScript experience

## Candidate Solutions

### Option A: Zustand

Pros: ...
Cons: ...
Risks: ...

### Option B: Redux Toolkit

...

## Recommended Option

Option A (Zustand), because: ...

## Decision Criteria

If [condition], we will re-evaluate.

## Scope of Impact

- Files to migrate: ...
- Estimated effort: ...

## Objections

@engineer thinks..., the response is...
```

**The value of RFCs goes beyond documentation**:

1. Forces you to think things through
2. Gives the team a chance to speak up
3. Months later, you can look up why this decision was made

## Irreversible vs. Reversible Decisions

Bezos's "one-way door vs. two-way door" theory applies to technical decisions:

```
High reversibility (two-way door) → Decide quickly, switch if it doesn't work
  - State management library
  - UI component library
  - Testing framework

Low reversibility (one-way door) → Decide carefully, spend more time reasoning
  - Database selection
  - Frontend-backend architecture (SPA vs SSR vs MPA)
  - Primary language/framework
  - Cloud provider
```

Don't over-analyze "two-way door" decisions. Make the call, get it running, iterate.

## Summary

- Use a multi-dimension matrix for tech selection, not gut feeling
- Write RFCs for important decisions, involve the team, leave a decision record
- Distinguish reversible from irreversible decisions; be more careful with irreversible ones
- Avoid: using Star count, big-company endorsement, or the allure of new tech as the main selection criteria
- The most important question: **Which specific problem we currently face does this technology solve?**
