import { defineConfig } from 'astro/config'
import tailwind from "@astrojs/tailwind"

import robotsTxt from "astro-robots-txt"
import sitemap from "@astrojs/sitemap"

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), sitemap(), robotsTxt()],
  site: 'https://portfolio-tsimanary.vercel.app/',
  // La barre d'outils de dev d'Astro se superposait à la navigation du bas
  devToolbar: { enabled: false }
})
