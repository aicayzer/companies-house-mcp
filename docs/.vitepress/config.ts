import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Companies House',
  description: 'CLI and MCP server for the UK Companies House API. Look up companies, officers, filings, charges, and ownership — from your terminal or any AI tool that speaks MCP.',
  lang: 'en-GB',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#1d4ed8' }],
  ],

  sitemap: {
    hostname: 'https://companies-house.uk',
  },

  themeConfig: {
    siteTitle: 'Companies House',

    nav: [
      { text: 'Getting started', link: '/getting-started' },
      { text: 'CLI', link: '/cli' },
      { text: 'Tools', link: '/tools' },
      { text: 'MCP setup', link: '/mcp' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting started', link: '/getting-started' },
        ],
      },
      {
        text: 'CLI',
        items: [
          { text: 'Commands', link: '/cli' },
        ],
      },
      {
        text: 'MCP server',
        items: [
          { text: 'Tools reference', link: '/tools' },
          { text: 'Setup', link: '/mcp' },
        ],
      },
    ],

    editLink: {
      pattern: 'https://github.com/aicayzer/companies-house-mcp/edit/main/docs/:path',
      text: 'Edit this page',
    },

    footer: {
      message: 'Not affiliated with or endorsed by Companies House or the UK Government.',
      copyright: 'MIT Licence',
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
