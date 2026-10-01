

## Live 3D map (`live/`)

`live/index.html` is a live web map: streets, buildings and labels stream from OpenStreetMap vector tiles
(OpenFreeMap), with 3D terrain (AWS Terrain Tiles), a satellite view (Esri World Imagery) and 3D buildings.
For sites with a street address, the address is looked up live (Photon geocoder) and that building's
footprint is highlighted. Approximate sites get a shaded area instead of a pin that implies false precision.
Search accepts any Slovenian address, and clicking a building at close zoom highlights it and shows the nearest address.

All services are keyless. Serve over GitHub Pages and open `/live/`. Deep links: `#zag`, `#hq`, `#explore`, `#kiosk`.
