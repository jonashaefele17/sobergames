/** Pfade aller Dateien unter public/media, z. B. `media/guess-the-location/bild-1.jpg` (siehe vite.config.ts) */
declare module 'virtual:media' {
  const files: string[]
  export default files
}
