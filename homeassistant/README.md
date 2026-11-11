# Gas Counter in Home Assistant

Der Gas Counter meldet sich per **MQTT-Discovery** selbst in Home Assistant an.
Ein Gerät mit allen Sensoren wird automatisch angelegt. Die Dateien in
diesem Ordner ergänzen das um kWh-Umrechnung, Kosten und eine fertige
Dashboard-Ansicht.

| Datei | Inhalt |
|---|---|
| [packages/gas_counter.yaml](packages/gas_counter.yaml) | Helfer (Brennwert, Zustandszahl, Preise), Template-Sensoren, Verbrauchszähler |
| [dashboard/gas_counter_dashboard.yaml](dashboard/gas_counter_dashboard.yaml) | Dashboard „Gas“ (nur Standardkarten) |

## Voraussetzungen

- Home Assistant **2025.10 oder neuer**. Die Firmware gibt mit `default_entity_id`
  feste Entitäts-IDs vor (`sensor.gascounter_…`).
- MQTT-Integration ist eingerichtet (z.B. Mosquitto-Add-on).
- Im Gas Counter unter *MQTT* ist der Broker eingetragen und **Home Assistant
  Discovery** aktiviert. Der Discovery-Präfix ist normalerweise `homeassistant`.
- Der Zählerstand wurde in der Weboberfläche des Gas Counters einmal gesetzt
  (*Einstellungen → Gas Counter → Zählerstand*). Vorher meldet das Gerät keinen
  Zählerstand, die Entität steht dann auf „unbekannt“.

## Vom Gerät angelegte Sensoren

| Entität | Bedeutung | Klasse |
|---|---|---|
| `sensor.gascounter_meter_reading` | Zählerstand der Gasuhr (m³) | gas, total_increasing |
| `sensor.gascounter_flow` | aktueller Durchfluss (m³/h) | volume_flow_rate, measurement |
| `sensor.gascounter_last_hour` | Verbrauch der letzten 60 Minuten (m³), gleitend | measurement |
| `sensor.gascounter_today` | Verbrauch heute (m³), Reset um Mitternacht | gas, total_increasing |
| `sensor.gascounter_yesterday` | Verbrauch gestern (m³) | gas |
| `sensor.gascounter_total` | Verbrauch seit Inbetriebnahme des Geräts (m³) | gas, total_increasing |
| `sensor.gascounter_last_tick` | Zeitpunkt des letzten Impulses | timestamp |
| `sensor.gascounter_ticks` | Anzahl Impulse | Diagnose |
| `sensor.gascounter_volume_per_tick` | eingestelltes Volumen pro Impuls (m³) | Diagnose |

Das Gerät sendet seinen Zustand bei jedem Impuls, direkt nach dem
(Wieder-)Verbinden und zusätzlich alle 60 Sekunden. Dadurch fällt der
Durchfluss in Home Assistant auf 0, wenn kein Gas mehr fließt, und der
Wert „heute“ wird um Mitternacht zurückgesetzt.

## Installation

### 1. Package einbinden

In der `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

Dann `packages/gas_counter.yaml` in den Ordner `/config/packages/` kopieren.
Unter *Entwicklerwerkzeuge → YAML* die Konfiguration prüfen und Home Assistant
neu starten.

### 2. Tarif eintragen

Unter *Einstellungen → Geräte & Dienste → Helfer* (oder auf dem Dashboard)
die Werte aus der Gasrechnung eintragen:

- **Gas Brennwert** (kWh/m³, z.B. 11,2)
- **Gas Zustandszahl** (z.B. 0,9535)
- **Gas Arbeitspreis** (ct/kWh)
- **Gas Grundpreis** (EUR/Monat)

### 3. Energie-Dashboard

*Einstellungen → Dashboards → Energie → Gasverbrauch → Gasquelle hinzufügen*

- **Gasverbrauch:** `sensor.gascounter_meter_reading` (m³)
- **Kosten:** „Entität mit aktuellem Preis verwenden“ → `sensor.gas_preis_pro_m3`

Alternativ lässt sich der Verbrauch in kWh erfassen. Dann `sensor.gas_energie_gesamt`
als Quelle und `sensor.gas_preis_pro_kwh` als Preis wählen. Achtung: Wenn sich
Brennwert oder Zustandszahl ändern, springt dieser Wert.

### 4. Dashboard

Die automatisch erzeugte **„Übersicht“** lässt keine eigenen Ansichten zu. Ihr
Stift-Symbol öffnet nur deren Anzeigeeinstellungen. Deshalb ein eigenes
Dashboard anlegen:

1. *Einstellungen → Dashboards → „+ Dashboard hinzufügen“ → „Neues Dashboard
   von Grund auf“*, Titel z.B. „Gas“, Symbol `mdi:meter-gas`.
2. Das neue Dashboard in der Seitenleiste öffnen und oben rechts auf das
   **Stift-Symbol** klicken.
3. Oben rechts **⋮ → „Raw-Konfigurationseditor“** wählen.
4. Den gesamten Inhalt durch `dashboard/gas_counter_dashboard.yaml` ersetzen,
   **Speichern** und den Editor schließen.

## Hinweise

- **Zählerstand korrigieren:** Ein höherer Wert zählt in den Statistiken als
  Verbrauch. Ein niedrigerer Wert gilt als Zähler-Reset. Fehlerhafte Werte in
  der Statistik lassen sich unter *Entwicklerwerkzeuge → Statistik* anpassen.
- **Bereits vorhandene Entitäten:** Wurde der Gas Counter schon mit einer
  älteren Firmware in Home Assistant eingebunden, behalten die vorhandenen
  Entitäten ihre bisherigen IDs (z.B. `sensor.<gerät>_gas_impulse`). Entweder
  diese Entitäten unter *Einstellungen → Entitäten* umbenennen. Oder das Gerät
  in der MQTT-Integration löschen, damit es neu angelegt wird.
- **Dauerverbrauch-Warnung:** `binary_sensor.gas_dauerverbrauch` schaltet ein,
  wenn mehr als 4 Stunden ununterbrochen Gas fließt. Bei durchgehendem
  Heizbetrieb im Winter kann das normal sein. Dann `delay_on` im Package
  anpassen.
- **Discovery prüfen:**
  `mosquitto_sub -v -t 'homeassistant/device/+/config' -t '<topic>/state'`
  zeigt das Discovery-Dokument und die State-Meldungen.
