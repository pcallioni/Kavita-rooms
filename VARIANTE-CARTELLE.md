# Kavita – Variante Cartelle

Fork personale di [Kavita](https://github.com/Kareadita/Kavita) (GPL-3.0) con tre modifiche:

1. **Copertine piccole**: circa il doppio di copertine per schermata.
2. **Pagina Cartelle**: pulsante "Cartelle" nella pagina di ogni libreria, per navigarla per directory come in un file manager.
3. **Ogni libro legato alla sua cartella**: al nome viene aggiunta la cartella che lo contiene, per esempio `Poesie [Kafka]`.
   Libri con lo stesso titolo in cartelle diverse restano separati.
   Nota: se si rinomina o si sposta una cartella, i suoi libri vengono visti come nuovi e si perde l'avanzamento di lettura.

## Immagine Docker

Viene compilata automaticamente da GitHub Actions a ogni push sul ramo `cartelle`:
`ghcr.io/pcallioni/kavita-cartelle:latest`

```yaml
services:
  kavita:
    image: ghcr.io/pcallioni/kavita-cartelle:latest
    container_name: kavita
    restart: unless-stopped
    environment:
      - TZ=Europe/Rome
    volumes:
      - ./config:/kavita/config
      - /mnt/dati/Books:/books:ro
    ports:
      - "5000:5000"
```

## File modificati

- `Kavita.Services/Scanner/ParseScannedFiles.cs` – `BindSeriesToFolder`
- `UI/Web/src/theme/themes/dark.scss`, `UI/Web/src/_card-item-common.scss`, griglie delle pagine – dimensione copertine
- `UI/Web/src/app/cards/entity-card/*` – cartella mostrata sotto il titolo
- `UI/Web/src/app/folder-browser/*`, `app-routing.module.ts`, `library-detail/*` – pagina Cartelle
- `.github/workflows/variante-cartelle-docker.yml` – compilazione dell'immagine
