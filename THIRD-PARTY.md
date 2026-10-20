# Herkunft

AtlasPlayer.mjs ist eine eigenständige, überarbeitete Implementierung nach dem gemeinsamen Puffer-/Cue-Prinzip von microLib Sounds.mjs (MIT, Meinolf Amekudzi); keine unveränderte Kopie und kein Ersatz innerhalb von microLib. Quelle: https://github.com/mamekudz/microLib. Der vorhandene Loader bleibt unverändert.

public/vendor/i18x-engine.mjs stammt aus gulp-mu-gulp-api 0.7.0 (MIT, Meinolf Amekudzi); Copyright-Kopf erhalten. Der Browser verwendet die bestehende i18x-Notation. Derzeit nur englische Ausgangstexte; weitere Sprachen folgen am Ende.

Die drei Sinustöne entstehen durch tools/Build.mjs; keine Fremdaufnahmen. LICENSE gilt für den Beispielcode und die generierten Töne.


WebA build dependency: ffmpeg-static 5.2.0 (GPL-3.0-or-later; FFmpeg binary and its components retain their own licenses). npm installs the platform-specific binary; it is not copied into the recipe repository or browser runtime. See node_modules/ffmpeg-static/README.md and LICENSE for distribution terms. Playwright is used only for development tests. All references/oxyd files retain Dongleware copyright and are excluded from the recipe's MIT license. See references/README.md; no original sound recordings included. Source snapshots are byte-identical to the referenced local originals as recorded in sources.json.
