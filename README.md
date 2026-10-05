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

## Spiele

Die 13 Spiele stehen fest in `src/games/catalog.ts`. Im Regiepult unter **Setup** lässt sich nur ihre Reihenfolge ändern; das letzte Spiel ist immer das Finale. Bei Arschbolzen gibt es dort den Umschalter auf die Schlechtwetter-Variante **Kippmoment**.

Jedes Spiel mit eigener Seite startet im Spiele-Tab über **„Spiel starten“** und wird im Tab **Spiel** gesteuert. Am Ende macht **„Spiel beenden & werten“** aus dem Ergebnis die Platzierung (3/2/1, bei Gleichstand geteilt).

| Spielart | Spiele | Im Regiepult |
|---|---|---|
| Punktetafel | Last Cup Standing, Closest to the Edge | „Runde an Team X“, optional mit Zielpunktzahl |
| Punktetafel | Arschbolzen | je Team 6 Versuche (änderbar), jeder einzeln mit 0 / 1 / 2 / 3 Punkten |
| Punktetafel | Scribble Rush, Mein Team kann | Punkte je Team eintragen, „Runde buchen“ |
| Stoppuhr | Ex oder zieh | je Team Start/Stopp, kürzeste Zeit gewinnt |
| Countdown | Build it | Timer läuft groß auf dem Beamer, danach Werte eintragen |
| Fragenrunde | Wer würde eher | Frage zeigen, je Team den Punkt antippen, eigene Fragenliste ohne Antworten |
| Messen | Perfect Cut | Objekte im Setup anlegen („Objekte bearbeiten“), im Spiel je Team beide Hälften in Gramm eintragen, kleinste Gesamtdifferenz gewinnt |
| Schätzen | Schätzfragen | Teams tippen am Handy, Schätzungen einzeln aufdecken, dann die Lösung; siehe unten |
| Buzzer-Quiz | Allgemeinwissen, Guess the Location, Songs erraten | siehe unten |

Jede Buchung lässt sich rückgängig machen oder einzeln löschen. Zielpunktzahl, Zahl der Versuche und Timer-Voreinstellung stehen je Spiel in `src/games/catalog.ts`. Kippmoment (Schlechtwetter-Variante von Arschbolzen) hat keine Spielseite: Dort wird nur der Sieger im Spiele-Tab eingetragen.

**Ton beim Countdown:** In den letzten 10 Sekunden pocht es, bei 0 kommt ein Schlusston. Browser spielen Ton erst nach einer Eingabe im jeweiligen Fenster: im Beamer-Fenster einmal klicken oder eine Taste drücken (z. B. `F` für Vollbild), `S` schaltet um. Alternativ im Tab „Spiel“ „Ton auf diesem Gerät abspielen“ anhaken.

**Gemeinsame Uhr:** Alle Geräte gleichen ihre Uhr beim Laden mit dem Supabase-Server ab. Countdown und Stoppuhr laufen dadurch überall gleich, und eine Zeit darf auf einem Gerät gestartet und auf einem anderen gestoppt werden.

Allgemeinwissen, Guess the Location und Songs erraten sind **Buzzer-Quiz**-Spiele mit eigener Spielseite:

1. **Fragen pflegen:** Setup → beim Spiel **„Fragen bearbeiten“**. Eine Liste lässt sich einfügen: eine Zeile pro Frage, `Frage | Antwort | Zusatzinfo`, oder direkt aus Excel/Google Sheets kopiert (Spalten Frage, Antwort, Info). Danach einzeln bearbeiten, sortieren und optional ein Bild aus dem Medienordner wählen. Gespeichert wird automatisch, und nur mit Host-Login lesbar.
2. **Spielen:** Spiele-Tab → **„Spiel starten“** → Tab **Spiel**. Dort laufen Timer (nur zur Orientierung, nach 0 geht es einfach weiter), aktuelle Frage mit Antwort, Richtig/Falsch, Auflösen und Nächste Frage.
3. **Spiel beenden & werten:** Die Rundenpunkte werden zur Platzierung (3/2/1) in der Tabelle.

Bei **Guess the Location** trägst du pro Eintrag nur den **Ort (Lösung)** und darunter die **Hinweise** ein (Bild oder Text). Der erste Hinweis erscheint sofort, die weiteren deckst du im Tab „Spiel“ einzeln auf; der neueste steht groß, die früheren klein daneben.

Bei **Songs erraten** trägst du pro Eintrag den **Song (Lösung)** ein, wählst die Datei aus dem Medienordner und gibst optional „Start bei Sekunde“ an. Im Tab „Spiel“ läuft nach „Song 1 zeigen“ noch nichts: Du spielst die Stufen selbst an (**0,1 s / 0,5 s / 2 s / 8 s / 15 s**, änderbar in `src/games/catalog.ts`), mit „Nochmal“, „Stopp“ und „Song ausspielen“. Beim Buzz stoppt die Musik von selbst. Der Ton kommt aus dem **Beamer-Fenster**; dort muss wie beim Countdown einmal geklickt oder eine Taste gedrückt worden sein.

### Schätzfragen

1. **Fragen pflegen:** Setup → „Fragen bearbeiten“, eine Zeile pro Frage: `Frage | Lösung als Zahl | Zusatzinfo` (z. B. Einheit oder Quelle).
2. **Frage zeigen:** Die Teams tippen ihre Schätzung auf ihrem Handy ein (dieselbe Seite wie der Buzzer) und können sie ändern, bis du **„Eingabe schließen“** drückst. Im Regiepult siehst du nur, wer abgegeben hat.
3. **Aufdecken:** Je Team einzeln in beliebiger Reihenfolge oder „Alle aufdecken“, danach **„Lösung aufdecken“**.
4. **Wertung:** Standard ist 1 Punkt für das nächste Team, bei gleichem Abstand für beide. Umschaltbar auf „Abgestuft 2 / 1“. Punkte lassen sich mit ± korrigieren; fällt ein Handy aus, trägst du die Schätzung von Hand ein.

Die Schätzungen der anderen kann kein Handy lesen; auf den Beamer kommen sie erst beim Aufdecken.

## Bilder und Songs

Mediendateien liegen im Repo, nicht in Supabase:

```
public/media/guess-the-location/   Bilder für die Hinweise
public/media/allgemeinwissen/      Bilder zu einzelnen Fragen
public/media/schaetzfragen/        Bilder zu einzelnen Fragen
public/media/songs-erraten/        MP3s
```

1. Dateien in den Ordner des Spiels legen. Bilder vorher auf etwa 1600 px Breite verkleinern.
2. Committen und pushen.
3. Nach dem Deploy stehen sie im Editor des Spiels zur Auswahl („Bild wählen“, „+ Bild-Hinweis“ bzw. „Song wählen“).

Die Dateien sind öffentlich abrufbar. Dateinamen sollten deshalb die Lösung nicht verraten.

## Abend vorbereiten und sichern

Fragen, Orte und Objekte liegen getrennt vom Spielstand. **Kein Zurücksetzen löscht sie.** Du kannst also alles eintragen, beliebig proben und vor dem Abend im Tab **Reset** „Punkte + Auslosung zurücksetzen“ drücken: Spieler, Teamnamen und Spielreihenfolge bleiben.

Im selben Tab gibt es **„Sicherung herunterladen“** (eine Datei mit dem kompletten Spielstand und allen Inhalten) und **„Sicherung einspielen“**. „Alles zurücksetzen“ verlangt das Eintippen von LÖSCHEN.

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
