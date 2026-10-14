import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('../docs/.vitepress/theme/post-list.ts');

test('restores filters and rejects malformed page/category parameters', async () => {
  const { readFilters } = await load();
  assert.deepEqual(readFilters('?q=cache&category=React&page=3', ['React']), {
    query: 'cache', category: 'React', page: 3,
  });
  for (const page of ['0', '-2', '2.5', 'nope', 'Infinity', '9999999999999999999']) {
    assert.equal(readFilters(`?page=${page}`, []).page, 1);
  }
  assert.equal(readFilters('?category=unknown', ['React']).category, null);
});

test('search matches title, summary and tags within current category', async () => {
  const { filterPosts } = await load();
  const posts = [
    { title: 'Requests', description: 'Cache and retries', tags: ['React'] },
    { title: 'Cache', description: '', tags: ['Vue'] },
    { title: 'Rendering', description: '', tags: ['React', 'SSR'] },
  ];
  assert.deepEqual(filterPosts(posts, { query: 'CACHE', category: null }, []), posts.slice(0, 2));
  assert.deepEqual(filterPosts(posts, { query: 'ssr', category: null }, []), [posts[2]]);
  assert.deepEqual(filterPosts(posts, { query: 'cache', category: 'React' }, [
    { id: 'React', matchTags: ['React'] },
  ]), [posts[0]]);
  assert.deepEqual(filterPosts(posts, { query: '   ', category: null }, []), posts);
});

test('shareable filters preserve unrelated parameters and omit default values', async () => {
  const { writeFilters, clampPage } = await load();
  assert.equal(writeFilters('/blog/posts/?utm_source=rss#articles', {
    query: 'React hooks', category: 'React', page: 2,
  }), '/blog/posts/?utm_source=rss&q=React+hooks&category=React&page=2#articles');
  assert.equal(writeFilters('/blog/posts/?q=old&page=4', {
    query: '', category: null, page: 1,
  }), '/blog/posts/');
  assert.equal(clampPage(76, 0), 1);
  assert.equal(clampPage(76, 3), 3);
});

test('related reading excludes self, other languages and unrelated articles', async () => {
  const { relatedPosts } = await load();
  const posts = [
    { url: '/posts/a.html', tags: ['React'], date: '2026-01-01' },
    { url: '/posts/b.html', tags: ['React'], date: '2026-01-02' },
    { url: '/en/posts/b.html', tags: ['React'], date: '2026-01-02' },
    { url: '/posts/c.html', tags: ['Vue'], date: '2026-01-03' },
  ];
  assert.deepEqual(relatedPosts(posts, '/posts/a.html', ['React']), [posts[1]]);
  assert.deepEqual(relatedPosts(posts, '/posts/a.html', []), []);
});
