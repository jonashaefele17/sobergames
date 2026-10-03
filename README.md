# The Sober Games 2026

Webseite, die durch den Abend führt: Logo-Intro, Teamauslosung per Glücksrad, Spieleübersicht mit Aufdecken, Punktevergabe, Tabelle und ein Buzzer für die Team-Handys.

## Ansichten

| Adresse | Zweck |
|---|---|
| `/` | **Show** für den Beamer. Zeigt nur, was das Regiepult vorgibt. `F` = Vollbild, `S` = Rad-Ticken an/aus |
| `/#/host` | **Regiepult** für Laptop und Handy: Szene wählen, Rad drehen, Spiele aufdecken, Punkte vergeben, Buzzer, Setup, Reset |
| `/#/buzz/<code>` | **Buzzer** eines Teams. Wird nur über den QR-Code aus dem Regiepult geöffnet |

Zum Proben vorher einfach durchspielen und danach unter **Reset → Punkte + Auslosung zurücksetzen** aufräumen: Spieler, Teamnamen und die Spieleliste bleiben erhalten.

## Buzzer

1. Regiepult → Tab **Buzzer** → bei jedem Team **QR zeigen** und den Code nur diesem Team zeigen. Ein grüner Punkt heißt: Handy verbunden.
2. **Buzzer scharf schalten.** Auf dem Beamer erscheint unten der Rundenstand. Wer zuerst drückt, erscheint groß auf Beamer und Regiepult.
3. **Richtig** gibt +1 Rundenpunkt und startet die nächste Frage. **Falsch** sperrt das Team für diese Frage, die anderen dürfen wieder.
4. Am Ende **Ergebnis übernehmen**: Die Rundenpunkte werden als Platzierung in das gewählte Spiel geschrieben.

Taucht ein QR-Code beim falschen Team auf, erzeugt **Neuer Code** einen neuen, der alte funktioniert dann nicht mehr. Unter **Ohne Handys ausprobieren** gibt es einen Buzz-Knopf je Team.

## Starten

```
npm install
npm run dev
```

Ohne `.env` läuft alles lokal: Der Stand liegt im Browser, Show, Regiepult und Buzzer synchronisieren sich zwischen Fenstern desselben Browsers.

## Supabase einrichten (Stand auf allen Geräten, absturzsicher)

Die Sober Games haben ein eigenes Supabase-Projekt, unabhängig vom Buzzer-Projekt.

1. Auf supabase.com ein neues Projekt **sobergames** anlegen, Region **Frankfurt (eu-central-1)**.
2. SQL Editor → New query → Inhalt von `supabase/schema.sql` einfügen → Run. Das Skript darf nach Änderungen erneut ausgeführt werden.
3. Authentication → Sign In / Providers → **„Allow new users to sign up“ ausschalten**.
4. Authentication → Users → Add user → Create new user: E-Mail `host@sobergames.local`, Passwort frei wählen, **„Auto Confirm User“ an**. Im Regiepult meldet ihr euch dann mit Benutzername `host` und diesem Passwort an.
5. Project Settings → API Keys: Project URL und Publishable Key in eine `.env` eintragen (Vorlage: `.env.example`).

## Veröffentlichen (GitHub Pages)

1. Repository → Settings → Secrets and variables → Actions: `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` anlegen.
2. Settings → Pages → Source: **GitHub Actions**.
3. Push auf `main`: `.github/workflows/deploy.yml` baut und veröffentlicht die Seite.

Der Publishable Key ist absichtlich öffentlich. Geschützt wird alles über die Rechte in `schema.sql`: Ohne Login kann man nur lesen und mit gültigem Code buzzern.

`.github/workflows/keepalive.yml` liest alle 3 Tage einmal die Datenbank, weil Supabase Gratis-Projekte nach 7 Tagen ohne Aktivität pausiert.

## Befehle

- `npm run build` – Typprüfung und Produktions-Build
- `npm run lint` – ESLint
- `npm test` – Tests für Wertung, Auslosung, Rennstand und Buzzer
