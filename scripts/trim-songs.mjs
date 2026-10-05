// Kürzt die MP3s für „Songs erraten“ auf die ersten Sekunden, ohne neu zu kodieren
// (es werden ganze MP3-Frames kopiert, die Qualität bleibt also gleich).
//
//   npm run songs:trim                      alle MP3s in public/media/songs-erraten/ auf 40 s
//   npm run songs:trim -- --seconds 30      andere Länge
//   npm run songs:trim -- --start 45        erst ab Sekunde 45 (z. B. direkt der Refrain)
//   npm run songs:trim -- "pfad/zum/song.mp3" …   nur bestimmte Dateien
//
// Die Originale landen vorher in originale/ (nicht im Repo). Dateien, die schon
// kurz genug sind, bleiben unangetastet – das Skript kann beliebig oft laufen.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SONGS = join(ROOT, 'public/media/songs-erraten')
const BACKUP = join(ROOT, 'originale')

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return fallback
  const value = Number(args.splice(i, 2)[1])
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} braucht eine Zahl`)
  return value
}
const seconds = option('seconds', 40)
const start = option('start', 0)
const files = args.length ? args : readdirSync(SONGS).filter((f) => /\.mp3$/i.test(f)).map((f) => join(SONGS, f))

const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG 1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG 2 / 2.5 Layer III
}
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }

/** liest den Frame-Kopf an `pos`; null, wenn dort kein gültiger Layer-III-Frame beginnt */
function frameAt(data, pos) {
  if (pos + 4 > data.length || data[pos] !== 0xff || (data[pos + 1] & 0xe0) !== 0xe0) return null
  const version = (data[pos + 1] >> 3) & 3 // 3 = MPEG 1, 2 = MPEG 2, 0 = MPEG 2.5
  const layer = (data[pos + 1] >> 1) & 3 // 1 = Layer III
  const bitrate = BITRATES[version === 3 ? 1 : 2][data[pos + 2] >> 4]
  const rate = RATES[version]?.[(data[pos + 2] >> 2) & 3]
  if (layer !== 1 || !bitrate || !rate) return null
  const padding = (data[pos + 2] >> 1) & 1
  const samples = version === 3 ? 1152 : 576
  const mono = data[pos + 3] >> 6 === 3
  return {
    size: Math.floor(((samples / 8) * bitrate * 1000) / rate) + padding,
    duration: samples / rate,
    // hinter Kopf und Seiteninformation steht im ersten Frame oft der Xing/Info-Block mit der Gesamtlänge
    infoAt: pos + 4 + (version === 3 ? (mono ? 17 : 32) : mono ? 9 : 17),
  }
}

function trim(data) {
  // ID3v2 am Anfang überspringen (enthält oft auch das Cover)
  let pos = 0
  if (data.toString('latin1', 0, 3) === 'ID3') {
    pos = 10 + ((data[6] & 0x7f) << 21) + ((data[7] & 0x7f) << 14) + ((data[8] & 0x7f) << 7) + (data[9] & 0x7f)
  }
  const parts = []
  let info = null
  let total = 0
  let kept = 0
  while (pos < data.length) {
    const frame = frameAt(data, pos)
    // nur als Frame werten, wenn direkt dahinter der nächste beginnt (oder die Datei endet)
    if (!frame || (pos + frame.size < data.length - 128 && !frameAt(data, pos + frame.size))) {
      pos++
      continue
    }
    const chunk = data.subarray(pos, pos + frame.size)
    const tag = data.toString('latin1', frame.infoAt, frame.infoAt + 4)
    if (!info && total === 0 && (tag === 'Xing' || tag === 'Info')) {
      info = { chunk: Buffer.from(chunk), at: frame.infoAt - pos }
    } else {
      if (total >= start && kept < seconds) {
        parts.push(chunk)
        kept += frame.duration
      }
      total += frame.duration
    }
    pos += frame.size
  }
  if (info) {
    // Anzahl der Frames und Bytes im Info-Block an die gekürzte Datei anpassen
    const flags = info.chunk.readUInt32BE(info.at + 4)
    let at = info.at + 8
    if (flags & 1) info.chunk.writeUInt32BE(parts.length, at), (at += 4)
    if (flags & 2) info.chunk.writeUInt32BE(parts.reduce((n, p) => n + p.length, info.chunk.length), at)
    parts.unshift(info.chunk)
  }
  return { out: Buffer.concat(parts), total, kept }
}

const fmt = (s) => `${s.toFixed(1)} s`
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`

for (const file of files) {
  const name = basename(file)
  if (!existsSync(file)) {
    console.log(`✗ ${name}: Datei nicht gefunden`)
    continue
  }
  const data = readFileSync(file)
  const { out, total, kept } = trim(data)
  if (total === 0) {
    console.log(`✗ ${name}: keine MP3-Daten gefunden, nichts geändert`)
  } else if (kept === 0) {
    console.log(`✗ ${name}: nur ${fmt(total)} lang, --start ${start} liegt dahinter, nichts geändert`)
  } else if (start === 0 && total <= seconds + 0.5) {
    console.log(`– ${name}: schon ${fmt(total)}, bleibt wie es ist`)
  } else {
    mkdirSync(BACKUP, { recursive: true })
    const backup = join(BACKUP, name)
    if (!existsSync(backup)) copyFileSync(file, backup)
    writeFileSync(file, out)
    console.log(`✓ ${name}: ${fmt(total)} → ${fmt(kept)}${start ? ` (ab ${start} s)` : ''}, ${mb(data.length)} → ${mb(out.length)}`)
  }
}
