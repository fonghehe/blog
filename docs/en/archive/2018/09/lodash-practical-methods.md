---
title: "Lodash: Practical Methods You Should Know"
date: 2018-09-28 15:30:34
tags:
  - JavaScript
readingTime: 1
description: "Lodash is one of the most-used utility libraries in frontend projects, but many developers only use a fraction of it. Here are the most practical methods for ev"
wordCount: 41
---

Lodash is one of the most-used utility libraries in frontend projects, but many developers only use a fraction of it. Here are the most practical methods for everyday work.

## Object Operations

```javascript
import _ from "lodash";

const user = {
  name: "Alice",
  address: {
    city: "Shanghai",
    district: "Pudong",
  },
  roles: ["admin", "editor"],
};

// _.get: safely access nested properties
_.get(user, "address.city"); // 'Shanghai'
_.get(user, "address.country"); // undefined (no error)
_.get(user, "address.country", "China"); // 'China' (default value)

// _.set: safely set nested properties
const updated = _.set({ ...user }, "address.country", "China");

// _.pick: keep only specified properties
_.pick(user, ["name", "address"]); // { name: 'Alice', address: {...} }

// _.omit: remove specified properties
_.omit(user, ["roles"]); // removes the roles property

// _.cloneDeep: deep clone
const copy = _.cloneDeep(user);

// _.merge: deep merge (Object.assign is shallow)
const defaults = { theme: "light", lang: "en", pagination: { pageSize: 20 } };
const userConfig = { lang: "fr", pagination: { page: 1 } };
_.merge({}, defaults, userConfig);
// { theme: 'light', lang: 'fr', pagination: { pageSize: 20, page: 1 } }
```

## Array Operations

```javascript
const arr = [1, 2, 3, 2, 1];

_.uniq(arr); // [1, 2, 3] (deduplicate)
_.uniqBy(users, "id"); // deduplicate by id
_.chunk([1, 2, 3, 4, 5], 2); // [[1,2],[3,4],[5]] (split into groups)
_.flatten([
  [1, 2],
  [3, [4]],
]); // [1,2,3,[4]] (flatten one level)
_.flattenDeep([[1, [2, [3]]]]); // [1,2,3] (fully flatten)
_.sortBy(users, ["age", "name"]); // multi-field sort
_.groupBy(users, "city"); // group by city
_.keyBy(users, "id"); // convert array to id-keyed object

// Practical use: convert user array to id → user map
const userMap = _.keyBy(users, "id");
userMap["123"]; // direct lookup by id
```

## Function Utilities

```javascript
// _.debounce: run fn n ms after the last call (stops firing)
const handleSearch = _.debounce((keyword) => {
  fetchResults(keyword);
}, 300);

// _.throttle: run at most once per n ms
const handleScroll = _.throttle(() => {
  checkScrollPosition();
}, 100);

// _.memoize: cache function results
const expensiveCalc = _.memoize((n) => {
  // expensive computation
  return n * n;
});

// _.once: execute only once
const init = _.once(() => {
  console.log("Initialized only once");
});
init();
init(); // no-op
```

## String Operations

```javascript
_.camelCase("hello-world"); // 'helloWorld'
_.kebabCase("helloWorld"); // 'hello-world'
_.snakeCase("helloWorld"); // 'hello_world'
_.startCase("helloWorld"); // 'Hello World'
_.truncate("Very long text here", { length: 10 }); // 'Very lon...'
_.template("Hello, <%= name %>!")({ name: "Alice" }); // 'Hello, Alice!'
```

## Tree-shaking (Reducing Bundle Size)

```javascript
// Full import: large bundle
import _ from "lodash";

// On-demand import: only bundle what you use
import get from "lodash/get";
import debounce from "lodash/debounce";
import cloneDeep from "lodash/cloneDeep";

// Or use lodash-es (ES module version, supports tree-shaking)
import { get, debounce } from "lodash-es";
```
