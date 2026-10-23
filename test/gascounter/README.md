# GasCounter-Regressionstests

Vom Projektverzeichnis aus:

```sh
sh test/gascounter/run.sh
```

Benötigt einen C++17-Compiler mit AddressSanitizer und UndefinedBehaviorSanitizer (`CXX` ist überschreibbar). Es werden keine zusätzlichen Bibliotheken heruntergeladen. Die ausführbare Datei entsteht im temporären Verzeichnis und wird danach entfernt.

Der Test kompiliert den Produktionscode aus `src/CGasCounter.cpp` und `src/CGasCounterStorage.cpp` gegen kleine Host-Adapter für die Hardware und Bibliotheksschnittstellen. Kontrollierte Impulse gehen über den tatsächlich in `startMonitoring()` registrierten Callback. Zeit, `millis()` und die Unterbrechung beim Verlassen einer kritischen Sektion sind steuerbar.

Geprüft werden:

- Kein Ereignisversand/Statusänderung im ISR; atomare Übergabe ohne verlorene Impulse bei Unterbrechungen während Snapshot und Ereignisverarbeitung.
- Erster Impuls bei Laufzeit null, Entprellen, wiederholter Monitoring-Start und Abmeldung beim Destruktor.
- Impulsperiode und Minutenwechsel über den 32-Bit-Überlauf von `millis()`.
- Durchfluss bei kurzen und langen Perioden sowie Abklingen bei Stillstand.
- 120 Minuten Impulsbetrieb über mehrere Pufferumläufe und Verwerfen abgelaufener Minuten nach Pausen; Sanitizer überwachen die Speichergrenzen.
- Jahreswechsel, übersprungene Mitternachtsminute, kein mehrfaches Zurücksetzen, mehrere übersprungene Tage, Schaltjahr, Sommerzeit und rückwärts korrigierte bzw. ungültige Zeit.
- JSON-Kompatibilität (Zusatzfelder, Reihenfolge, fehlende optionale Felder), exakte float-Roundtrips, Wertebereichsprüfung, Schutz unbekannter Schema-Versionen und Binär-v1-Migration.
- Persistenz über simulierte Neustarts, unveränderte Dateien im Leerlauf, fehlgeschlagener Dateiaustausch, Prüfsummenfehler, Speichern beim Shutdown und Tageswechsel nach Neustart.
- Konfigurations-Roundtrip, altes/neues Schlüsselformat, ungültige Werte und Verbrauch vor/nach Änderung des Impulsvolumens.

Die Tests verwenden den echten JsonNode-Parser und Serializer aus der Library. Die Hardware- und Dateisystemzugriffe werden durch Host-Adapter ersetzt. Der separate ESP8266-Firmware-Build prüft die Integration mit den echten Bibliotheks- und Framework-Headern. Gerätetests bleiben für elektrische Entprellung, ISR-Latenz, MQTT-Zustellung und NTP erforderlich.

Persistenz: Nach der LittleFS-Initialisierung und vor dem Monitoring ruft die Anwendung
`beginPersistence()` auf. Zähleränderungen und Tageswechsel werden im Hauptprogramm
unter `/gascounter.state` gespeichert; vor dem Shutdown wird zusätzlich gespeichert.
Der Austausch erfolgt über eine temporäre Datei per LittleFS-rename. Der Host-Adapter
prüft die Programmlogik; das Verhalten bei Stromausfall während einer Flash-Operation
muss am Gerät geprüft werden. Ein Stromausfall vor Abschluss der Speicherung kann
den letzten noch nicht gesicherten Impuls verlieren.

Gesamtwerte und Tagesbezug bleiben erhalten. Die auf `millis()` basierende
Durchflussperiode wird nach Neustart verworfen. Minutenwerte werden anhand der
Uhrzeit gealtert (Minutenauflösung); fehlt beim Laden eine verlässliche Zeit, wird
der Stundenverlauf gelöscht. Gesamt- und Tageszähler bleiben dabei erhalten.
Das Speicherformat ist JSON, geschrieben und gelesen mit `JsonNode`, unabhängig
vom Layout von `GasCounterStatus`. Der Dateiname bleibt `/gascounter.state`.
Die bisherige Binärdatei (v1) wird mit einem eingefrorenen Legacy-Layout gelesen
und einmalig nach JSON migriert (auf derselben Plattform wie die alte Firmware).

Der JSON-Umschlag enthält `schemaVersion: 2`, `data` und `checksum`.
`checksum` ist FNV-1a/32 über die kompakte JsonNode-Serialisierung von `data`.
Innerhalb von `data` sind `tickCounter` und `total` Pflichtfelder. Alle anderen
Felder sind optional: `totalCounter`, `today`, `yesterday` (Standard 0), `day`
(Standard -1), `savedAt` (Standard 0), `minuteIndex` (Standard 0) und `minutes`
(ein Objekt mit den Schlüsseln "0" bis "59", fehlende Werte jeweils 0).
Volumenwerte sind Dezimalstrings mit 9 signifikanten Stellen, damit jeder float
verlustfrei zurückgelesen wird; numerische JSON-Werte werden ebenfalls akzeptiert.
Ganzzahlen werden auf integrale Werte und ihren Wertebereich geprüft.

Bei zusätzlichen Feldern bleibt `schemaVersion` unverändert; die Feldreihenfolge
ist für die Zuordnung unerheblich. Unbekannte Felder werden beim Lesen ignoriert
und beim nächsten Speichern nicht übernommen. Neue optionale Felder benötigen
explizite Standardwerte im Leser. Bei Umbenennung oder semantischer Änderung muss
eine Migration ergänzt werden; JSON kann solche Änderungen nicht selbst erkennen.
Unbekannte Schema-Versionen, ungültige Werte und beschädigte Dateien werden
abgelehnt und nicht automatisch durch einen leeren Zählerstand überschrieben.
Die Dateigröße ist auf 32 KiB begrenzt.
