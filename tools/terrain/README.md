# National terrain for the Atlas

The live map renders relief from the public Mapzen/AWS *Terrain Tiles* (`elevation-tiles-prod`, Terrarium PNG, up to zoom 15).
Over Slovenia those tiles are built from 25–30 m sources (EU-DEM / SRTM), which is why river banks and embankments look
smoothed or draped at street zoom. No code change can fix that; only a better DEM can.

## Why the official lidar DEM cannot simply be copied into this repository

| | Size (estimate) |
|---|---|
| GURS lidar point clouds (LAZ), national | several TB |
| GURS DMR 1 m GeoTIFF, national | ~80 GB |
| Terrarium tiles built from a 1 m DEM, zoom ≤ 16, Slovenia only | ~4 GB |
| Terrarium tiles, zoom ≤ 14 (≈ 10 m per pixel), Slovenia only | ~0.7–1.1 GB |
| Terrarium tiles, zoom ≤ 13 (≈ 19 m per pixel), Slovenia only | ~250 MB |

GitHub limits: 100 MB per file, and the repository and the Pages site are each expected to stay under about 1 GB.
So the full-resolution national model does not fit in `ZAGMap`, and the spec rightly says not to put national lidar in GitHub.

## Recommended setup

1. **Keep the current tiles as the default** (they load from AWS, nothing to host).
2. **Build Slovenian tiles from the GURS DMR once, in GitHub Actions** (`.github/workflows/terrain.yml`, manual run). The workflow
   downloads the GeoTIFF(s) you point it to, reprojects to Web Mercator, encodes Terrarium PNG tiles up to the zoom you choose, and
   publishes them to a **separate repository** `ZAGMap-terrain` on GitHub Pages (its own 1 GB budget), or to any object storage.
3. **Point the Atlas at them**: set `DEM_URL` in `live/js/config.js` to the new tile URL template and keep the AWS template as fallback.

## What has to be checked by a person with internet access (the sandbox could not reach gov.si)

- Download URLs and format of the GURS DMR (DMR 1 m / DMV 5 m) on https://www.e-prostor.gov.si/ → *Javni dostop*.
- Licence text for attribution (GURS data are published under CC BY 4.0 according to podatki.gov.si; confirm for the DEM product).
- Whether GURS offers a WMTS/terrain service that can be used remotely instead of self-hosting; if so, prefer it.

Attribution to add once GURS tiles are live: *Relief: © Geodetska uprava Republike Slovenije, DMR, CC BY 4.0.*
