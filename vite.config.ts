import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const netlifySiteUrl = env.VITE_NETLIFY_SITE_URL?.trim()

  return {
    plugins: [
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      netlify(),
      tanstackStart(),
      viteReact(),
    ],
    server: netlifySiteUrl
      ? {
          proxy: {
            '/.netlify/identity': {
              target: netlifySiteUrl,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : undefined,
  }
})

export default config
