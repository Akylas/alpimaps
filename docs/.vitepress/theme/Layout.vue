<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'

const { frontmatter } = useData()
</script>

<template>
  <DefaultTheme.Layout>
    <template v-if="frontmatter.layout === 'home'" #home-hero-before>
      <div class="feature-graphic-banner">
        <img
          src="/featureGraphic.png"
          alt="AlpiMaps — Maps for real outdoor adventures"
          loading="eager"
          width="1024"
          height="500"
        />
      </div>
    </template>
  </DefaultTheme.Layout>
</template>
