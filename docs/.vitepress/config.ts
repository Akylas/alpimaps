import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AlpiMaps',
  description: 'Powerful outdoor maps & navigation — everything works 100% offline or online',
  head: [
    ['link', { rel: 'icon', href: '/icon.png' }],
    ['meta', { name: 'theme-color', content: '#1e72ce' }],
    ['meta', { property: 'og:image', content: '/featureGraphic.png' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200' }],
  ],
  themeConfig: {
    logo: '/icon.png',
    siteTitle: 'AlpiMaps',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Features', link: '/features' },
      {
        text: 'Documentation',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Map & Layers', link: '/guide/map-layers' },
          { text: 'Offline Maps', link: '/guide/offline-maps' },
          { text: 'Navigation & Routing', link: '/guide/navigation-routing' },
          { text: 'Elevation & Terrain', link: '/guide/elevation-terrain' },
          { text: 'GPS & Location', link: '/guide/gps-location' },
          { text: 'Search', link: '/guide/search' },
          { text: 'Markers & Items', link: '/guide/markers-items' },
          { text: 'Tools', link: '/guide/tools' },
          { text: 'Settings', link: '/guide/settings' },
          { text: 'API Keys', link: '/guide/api-keys' },
          { text: 'Custom Data Generation', link: '/guide/data-generation' },
        ]
      },
      {
        text: 'Download',
        items: [
          { text: 'Google Play', link: 'https://play.google.com/store/apps/details?id=akylas.alpi.maps' },
          { text: 'App Store', link: 'https://apps.apple.com/fr/app/alpimaps/id1045609978' },
          { text: 'GitHub Releases', link: 'https://github.com/Akylas/alpimaps/releases' },
          { text: 'IzzyOnDroid', link: 'https://apt.izzysoft.de/packages/akylas.alpi.maps' },
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/getting-started#installation' },
          ]
        },
        {
          text: 'Core Features',
          items: [
            { text: 'Map & Layers', link: '/guide/map-layers' },
            { text: 'Offline Maps', link: '/guide/offline-maps' },
            { text: 'Navigation & Routing', link: '/guide/navigation-routing' },
            { text: 'Elevation & Terrain', link: '/guide/elevation-terrain' },
            { text: 'GPS & Location', link: '/guide/gps-location' },
            { text: 'Search', link: '/guide/search' },
            { text: 'Markers & Items', link: '/guide/markers-items' },
          ]
        },
        {
          text: 'Tools',
          items: [
            { text: 'Tools Overview', link: '/guide/tools' },
            { text: 'Compass', link: '/guide/tools#compass' },
            { text: 'Astronomy', link: '/guide/tools#astronomy' },
            { text: 'GPS Satellites', link: '/guide/tools#gps-satellites' },
            { text: 'Transit Lines', link: '/guide/tools#transit-lines' },
          ]
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Settings Reference', link: '/guide/settings' },
            { text: 'API Keys', link: '/guide/api-keys' },
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Custom Data Generation', link: '/guide/data-generation' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Akylas/alpimaps' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Akylas'
    },

    editLink: {
      pattern: 'https://github.com/Akylas/alpimaps/edit/master/docs/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    }
  }
})
