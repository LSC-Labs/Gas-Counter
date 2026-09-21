# GasCounter-Regressionstests

Vom Projektverzeichnis aus:

```sh
sh test/gascounter/run.sh
```

Benötigt einen C++17-Compiler mit AddressSanitizer und UndefinedBehaviorSanitizer (`CXX` ist überschreibbar). Es werden keine zusätzlichen Bibliotheken heruntergeladen. Die ausführbare Datei entsteht im temporären Verzeichnis und wird danach entfernt.

Der Test kompiliert den unveränderten Produktionscode aus `src/CGasCounter.cpp` gegen kleine Host-Adapter für die Hardware und Bibliotheksschnittstellen. Kontrollierte Impulse gehen über den tatsächlich in `startMonitoring()` registrierten Callback. Zeit, `millis()` und die Unterbrechung beim Verlassen einer kritischen Sektion sind steuerbar.

Geprüft werden:

- Kein Ereignisversand/Statusänderung im ISR; atomare Übergabe ohne verlorene Impulse bei Unterbrechungen während Snapshot und Ereignisverarbeitung.
- Erster Impuls bei Laufzeit null, Entprellen, wiederholter Monitoring-Start und Abmeldung beim Destruktor.
- Impulsperiode und Minutenwechsel über den 32-Bit-Überlauf von `millis()`.
- Durchfluss bei kurzen und langen Perioden sowie Abklingen bei Stillstand.
- 120 Minuten Impulsbetrieb über mehrere Pufferumläufe und Verwerfen abgelaufener Minuten nach Pausen; Sanitizer überwachen die Speichergrenzen.
- Jahreswechsel, übersprungene Mitternachtsminute, kein mehrfaches Zurücksetzen, mehrere übersprungene Tage, Schaltjahr, Sommerzeit und rückwärts korrigierte bzw. ungültige Zeit.
- Konfigurations-Roundtrip, altes/neues Schlüsselformat, ungültige Werte und Verbrauch vor/nach Änderung des Impulsvolumens.

Die JSON-Adapter prüfen nur den Vertrag mit dem Konfigurationshandler, nicht den Parser der Bibliothek. Der separate ESP8266-Firmware-Build prüft die Integration mit den echten Bibliotheks- und Framework-Headern. Gerätetests bleiben für elektrische Entprellung, ISR-Latenz, MQTT-Zustellung und NTP erforderlich.
