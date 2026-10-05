import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** alle Dateien unter `dir`, als Pfade relativ zu `base` mit „/“ */
function walk(dir: string, base = ''): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), `${base}${e.name}/`) : e.name.startsWith('.') ? [] : [`${base}${e.name}`],
  )
}

/**
 * Stellt die Liste der Dateien unter public/media als Modul `virtual:media`
 * bereit. Die Seite kann zur Laufzeit keinen Ordner auflisten; der Editor im
 * Regiepult braucht die Liste, um Bilder und Songs zur Auswahl anzubieten.
 */
function mediaList(): Plugin {
  const id = 'virtual:media'
  const resolved = '\0' + id
  return {
    name: 'sobergames-media-list',
    resolveId: (source) => (source === id ? resolved : undefined),
    load(loaded) {
      if (loaded !== resolved) return
      const files = walk(join(import.meta.dirname, 'public/media'), 'media/').sort()
      return `export default ${JSON.stringify(files)}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), mediaList()],
})
