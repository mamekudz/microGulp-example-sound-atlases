# Sound Atlas Lab

Eigenständiges Browserbeispiel für Dateinamensmarker, Attack, Loop und Release, WebA/Opus und einen reproduzierbaren Performancevergleich. Recipe 1.1.0 ist unabhängig von der Hostversion µGulp 1.1.1 / API 0.7.0.

## Start

```sh
npm ci
npm test
npm run benchmark:build
npm start
```

http://127.0.0.1:9438/ öffnen. Enable audio, Take off, Land (release), Stop immediately. WebA ist der Standard, WAV kann ausgewählt und neu geladen werden. Die Töne sind synthetisch, keine FlyEx-Aufnahmen. Die Animation achtet auf prefers-reduced-motion.

## Integration

```js
import { AtlasPlayer } from './src/AtlasPlayer.mjs';
const player = new AtlasPlayer(new AudioContext());
// Enable() direkt innerhalb eines Benutzerklicks aufrufen.
await player.Enable();
await player.Load('./effects.json', './effects.weba');
const flight = player.Play('fly');
// Später, bei der Landung:
player.Stop(flight);
// Sofortiger Abbruch: player.Stop(flight, true).
// Aufräumen: await player.Dispose(); schließt auch den AudioContext.
```

Play erkennt Loops aus der JSON. Stop ohne force lässt den aktuellen Durchlauf samt Release enden; wiederholte Stopps sind idempotent. StopAll(true), Neuladen und Dispose stoppen sofort. Einzeleffekte verwenden den gemeinsamen Atlaspuffer. Loop-Sounds erhalten je Cue einen isolierten, gecachten Puffer inklusive Attack/Release. Das benötigt zusätzlichen PCM-Speicher, verhindert aber das Abspielen benachbarter Cues beim Auslaufen.

`fly.ls.2400.le.14400.wav` definiert bei 24 kHz 0,1 s Attack und einen Loop von 0,1 bis 0,6 s. Das Release reicht bis zum Dateiende. Parser und Builder liegen in tools/Build.mjs. Er erzeugt benannte Quelldateien unter public/generated/sources; diese Ausgaben nicht von Hand pflegen. Der Beispielbuilder ist ein synthetischer, reproduzierbarer Einstieg, kein allgemeiner Importer beliebiger Audiodateien.

config.json: sampleRate 24000 oder 48000, gapSeconds 0.02 bis 1, volume 0 bis 1. features.loops und failureTests steuern die Bedienung, nicht die Cue-Metadaten. Unbekannte Schlüssel werden abgewiesen. Nach Änderungen neu bauen.

## Messungen und Browserprüfung

`benchmark.html` vergleicht 32 identische PCM-Quellen in vier Varianten. No-store, fünf Runden, rotierende Reihenfolge, 6 oder 32 parallele Ladevorgänge. JSON-Download enthält Rohwerte. Nutzdaten ohne HTTP/TLS-Header; PCM-Schätzung ohne Browseroverhead. Keine CPU- oder subjektive Qualitätsmessung.

Automatisiert nach Start des Servers und benchmark:build:

```sh
npx playwright install chromium
npm run browser:test
```

Alternativ BROWSER_CHANNEL=chrome für vorhandenes Chrome, DEMO_URL für anderen Port. tools/BrowserCheck.mjs prüft echte Decodierung, Fehlerbehebung, Loop-Lebensdauer und rendert Attack/Loop/Release offline gegen ein Sollsignal. Anschließend misst es localhost und ein ausdrücklich simuliertes Profil (100 ms Latenz, 10 Mbit/s). measurements enthält Rohdaten, keine universellen Leistungszusagen. Hörabnahme, Firefox/Safari und Unity-Laufzeitprüfung bleiben separat.

## Quellen und Pflege

references enthält unveränderte, gehashte Quellen aus µLib, FlyEx und Oxyd. Sie sind Lesereferenzen, keine eigenständigen Runtime-Module und keine neue Pflegequelle. MIT gilt für den Recipe-Code und µLib; references/oxyd behält Dongleware-Copyright und benötigt eine eigene Weitergabefreigabe. Siehe references/README.md und THIRD-PARTY.md.

IntegrateRecipe.en-US.src.md ist der KI-Integrationsprompt. Weitere Übersetzungen erst am Ende. RELEASES.json führt die Recipe-Version; release:sync synchronisiert Paket und Lockdatei, release:check prüft sie. Eine Versionsänderung veröffentlicht nichts. BUILD_ATLAS hat Ctrl+Shift+F6, auf macOS Cmd+Shift+F6. Eigener Projekttitel und Logo in microgulp.config.json.

Build-Voraussetzung: npm ci lädt über ffmpeg-static das plattformspezifische FFmpeg-Binary. Der Build ruft es als Unterprozess auf; die fertige Webapp benötigt FFmpeg nicht. measurements/browser-check.json enthält die Framezahl- und Korrelationsprüfung gegen die WAV-Zeitachse.

<!-- blog-publication:start -->
Artikel: [Deutsch](https://microgulp.dev/de/blog/audio-sound-atlases/)

Weitere Beispiele: [microGulp-Examples](https://github.com/mamekudz/microGulp-Examples).
<!-- blog-publication:end -->
