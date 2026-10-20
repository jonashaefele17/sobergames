/** Speichert Daten als JSON-Datei auf dem Gerät */
export function downloadJson(fileName: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** Zeitstempel für Dateinamen, z. B. 2026-10-20-18-30 */
export const fileStamp = (iso: string) => iso.slice(0, 16).replace(/[:T]/g, '-')
