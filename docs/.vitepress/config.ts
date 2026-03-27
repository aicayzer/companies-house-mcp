import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Companies House',
  description: 'CLI and MCP server for the UK Companies House API. Look up companies, officers, filings, charges, and ownership — from your terminal or any AI tool that speaks MCP.',
  lang: 'en-GB',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#1f70b9' }],
  ],

  sitemap: {
    hostname: 'https://companies-house.uk',
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
