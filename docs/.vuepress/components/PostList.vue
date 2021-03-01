<template>
  <div class="pl-wrap">
    <!-- 文章列表 + 分页 -->
    <ul class="article-list">
      <li v-for="post in pagedPosts" :key="post.path" class="article-item">
        <time class="article-date">{{ post.fulldate }}</time>
        <router-link :to="post.path" class="article-title">{{ post.title }}</router-link>
      </li>
    </ul>

    <!-- 分页 -->
    <div class="pagination" v-if="totalPages > 1">
      <button class="page-btn" @click="page--" :disabled="page === 1">← 上一页</button>
      <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
      <button class="page-btn" @click="page++" :disabled="page === totalPages">下一页 →</button>
    </div>

    <!-- 2018-2021/02 历史归档 -->
    <div class="archive-section">
      <div class="archive-divider">
        <span>历史归档</span>
      </div>
      <p class="archive-desc">2018 年 — 2021 年 2 月的文章</p>
      <div class="archive-links">
        <div class="archive-row" v-for="item in archiveLinks" :key="item.label">
          <span class="archive-year-label">{{ item.year }}</span>
          <span class="archive-months">
            <router-link
              v-for="m in item.months"
              :key="m.path"
              :to="m.path"
              class="archive-month-link"
            >{{ m.label }}</router-link>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const PER_PAGE = 20

function isArchived(path) {
  const m = path.match(/^\/posts\/(\d{4})\/(\d{2})\//)
  if (!m) return false
  const y = parseInt(m[1]), mo = parseInt(m[2])
  return y < 2021 || (y === 2021 && mo <= 2)
}

export default {
  data() {
    return { page: 1 }
  },
  computed: {
    recentPosts() {
      return this.$site.pages
        .filter(p => {
          if (!p.path.startsWith('/posts/')) return false
          const segs = p.path.replace(/\/$/, '').split('/').filter(Boolean)
          if (segs.length < 3) return false
          return !isArchived(p.path)
        })
        .map(p => {
          const raw = p.frontmatter && p.frontmatter.date
          const d = raw ? new Date(raw) : null
          const yyyy = d ? d.getFullYear() : 0
          const mm = d ? String(d.getMonth() + 1).padStart(2, '0') : '00'
          const dd = d ? String(d.getDate()).padStart(2, '0') : '00'
          return {
            path: p.path,
            title: (p.title || p.path).replace(/^[""]|[""]$/g, ''),
            date: d,
            fulldate: d ? `${yyyy}-${mm}-${dd}` : ''
          }
        })
        .sort((a, b) => (b.date || 0) - (a.date || 0))
    },
    totalPages() {
      return Math.ceil(this.recentPosts.length / PER_PAGE)
    },
    pagedPosts() {
      const start = (this.page - 1) * PER_PAGE
      return this.recentPosts.slice(start, start + PER_PAGE)
    },
    archiveLinks() {
      return [
        {
          year: '2018',
          months: Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, '0')
            return { label: `${i + 1}月`, path: `/posts/2018/${m}/` }
          })
        },
        {
          year: '2019',
          months: Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, '0')
            return { label: `${i + 1}月`, path: `/posts/2019/${m}/` }
          })
        },
        {
          year: '2020',
          months: Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, '0')
            return { label: `${i + 1}月`, path: `/posts/2020/${m}/` }
          })
        },
        {
          year: '2021',
          months: [
            { label: '1月', path: '/posts/2021/01/' },
            { label: '2月', path: '/posts/2021/02/' }
          ]
        }
      ]
    }
  },
  watch: {
    page() {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
}
</script>

<style scoped>
.pl-wrap {
  max-width: 740px;
  padding: 0.5rem 0 4rem;
}

/* 文章列表 */
.article-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.article-item {
  display: flex;
  align-items: baseline;
  gap: 1.2rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid #f4f4f4;
}

.article-item:last-child {
  border-bottom: none;
}

.article-date {
  flex-shrink: 0;
  width: 3.5rem;
  font-size: 0.82rem;
  color: #aaa;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.article-title {
  font-size: 0.96rem;
  color: #2c3e50;
  text-decoration: none;
  line-height: 1.55;
  transition: color 0.15s;
}

.article-title:hover {
  color: #3eaf7c;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin: 2rem 0;
  padding: 1.5rem 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.page-btn {
  padding: 0.45rem 1.2rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  color: #3eaf7c;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: #3eaf7c;
  color: #fff;
  border-color: #3eaf7c;
}

.page-btn:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.9rem;
  color: #888;
}

/* 历史归档 */
.archive-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
}

.archive-divider {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.archive-divider::before,
.archive-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e0e0e0;
}

.archive-divider span {
  font-size: 0.82rem;
  color: #bbb;
  white-space: nowrap;
  letter-spacing: 0.05em;
}

.archive-desc {
  font-size: 0.85rem;
  color: #bbb;
  margin: 0 0 1rem;
  text-align: center;
}

.archive-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.archive-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.archive-year-label {
  font-size: 0.82rem;
  color: #999;
  width: 2.2rem;
  flex-shrink: 0;
  font-weight: 600;
}

.archive-months {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.5rem;
}

.archive-month-link {
  font-size: 0.8rem;
  color: #bbb;
  text-decoration: none;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  transition: all 0.15s;
}

.archive-month-link:hover {
  color: #3eaf7c;
  background: #f0faf6;
}
</style>
