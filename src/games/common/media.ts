import files from 'virtual:media'

// Bilder und Songs liegen im Repo unter public/media/<spiel>/ und werden mit
// der Seite ausgeliefert. Gespeichert wird je Eintrag nur der Pfad.

export type MediaKind = 'image' | 'audio' | 'other'

export interface MediaFile {
  /** Pfad relativ zur Seite, z. B. `media/guess-the-location/bild-1.jpg` */
  path: string
  name: string
  kind: MediaKind
}

const IMAGE = /\.(jpe?g|png|webp|gif|avif|svg)$/i
const AUDIO = /\.(mp3|m4a|ogg|wav|aac)$/i

export const mediaKind = (path: string): MediaKind => (IMAGE.test(path) ? 'image' : AUDIO.test(path) ? 'audio' : 'other')

/** Dateien im Ordner eines Spiels */
export function mediaFiles(gameId: string, all: string[] = files): MediaFile[] {
  const prefix = `media/${gameId}/`
  return all
    .filter((p) => p.startsWith(prefix))
    .map((path) => ({ path, name: path.slice(prefix.length), kind: mediaKind(path) }))
}

/** ob der Pfad auf eine Datei im Medienordner zeigt (ältere Einträge können auf frühere Uploads verweisen) */
export const isMediaPath = (path: string | null | undefined): path is string => Boolean(path?.startsWith('media/'))

/** Adresse einer Mediendatei relativ zur Seite; null, wenn der Pfad nicht in den Medienordner zeigt */
export const mediaUrl = (path: string | null | undefined): string | null => (isMediaPath(path) ? path : null)

/** der Ordner, in den die Dateien eines Spiels gehören */
export const mediaFolder = (gameId: string) => `public/media/${gameId}/`
