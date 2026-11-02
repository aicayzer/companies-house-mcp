import { defineConfig } from 'vitepress'

const siteUrl = 'https://companies-house.uk'

export default defineConfig({
  title: 'Companies House',
  description: 'CLI and MCP server for the UK Companies House API. Look up companies, officers, filings, charges, and ownership — from your terminal or any AI tool that speaks MCP.',
  lang: 'en-GB',
  cleanUrls: true,

  transformPageData(pageData) {
    if (pageData.relativePath === '404.md') return

    const path = pageData.relativePath
      .replace(/(^|\/)index\.md$/, '$1')
      .replace(/\.md$/, '')

    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push([
      'link',
      { rel: 'canonical', href: new URL(path, `${siteUrl}/`).href },
    ])
  },

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#1f70b9' }],
    // Cloudflare Web Analytics — cookieless beacon. The token is a public
    // site tag (embedded in page HTML), not a secret.
    [
      'script',
      {
        defer: '',
        src: 'https://static.cloudflareinsights.com/beacon.min.js',
        'data-cf-beacon': '{"token": "379eb544c2b44688a31845fa2b46cac5"}',
      },
    ],
  ],

  sitemap: {
    hostname: siteUrl,
  },

  themeConfig: {
    siteTitle: 'Companies House',

    nav: [
      { text: 'CLI', link: '/cli' },
      { text: 'MCP', link: '/mcp' },
    ],

    sidebar: [
      { text: 'Getting started', link: '/getting-started' },
      {
        text: 'CLI',
        items: [
          { text: 'Commands', link: '/cli' },
        ],
      },
      {
        text: 'MCP',
        items: [
          { text: 'Setup', link: '/mcp' },
          { text: 'Tools reference', link: '/tools' },
          { text: 'Self-hosting', link: '/self-hosting' },
        ],
      },
    ],

    editLink: {
      pattern: 'https://github.com/aicayzer/companies-house-mcp/edit/main/docs/:path',
      text: 'Edit this page',
    },

    footer: {
      message: 'Not affiliated with or endorsed by Companies House or the UK Government. MIT Licence.',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/aicayzer/companies-house-mcp' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/companies-house-mcp' },
    ],

    search: {
      provider: 'local',
    },
  },
})
