module.exports = {
  title: '前端成长记录',
  description: '一个前端工程师从 2018 年开始的学习与成长记录',
  base: '/',
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1' }]
  ],
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/posts/' }
    ],
    sidebar: {
      '/posts/': 'auto'
    },
    lastUpdated: '最后更新',
    smoothScroll: true
  }
}
