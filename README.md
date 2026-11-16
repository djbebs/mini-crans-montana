# Mini Crans-Montana

Independent repository for the Mini Crans-Montana interactive 3D village, its earlier prototypes, and the pixel atlas.

## Open the project

- [Latest interactive version (P0.6.7)](https://djbebs.github.io/mini-crans-montana/crans-montana-p067/)
- [Previous version (P0.6.6)](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/)
- [Pixel Atlas](https://djbebs.github.io/mini-crans-montana/crans-montana-pixel-atlas/)
- [Project home](https://djbebs.github.io/mini-crans-montana/)

## Structure

- `crans-montana-p067/`: latest release, with the complete Ycoor app, local DXF volumes and documented façade details
- `preview-ycoor-design/`: canonical Ycoor app and shared design modules, evidence and DXF datasets
- `crans-montana-p06/`: previous P0.6.6 version and shared engine, with characters, playground geometry, and collision code
- `preview-p068/`: separate P0.6.8 façade experiment
- `crans-montana-p06/streetview/`: optional Street View evidence layer for the stable P0.6.6 atlas
- `crans-montana-p059/`, `crans-montana-p058/`, `crans-montana-p057/`, `crans-montana-p056/`, `crans-montana-p055/`, `crans-montana-p054/`, `crans-montana-p05/`, `crans-montana-p0/`: archived prototypes
- `crans-montana-pixel-atlas/`: pixel atlas and alternative 3D view
- `index.html`: project entry page

Migrated from [sudoku-world](https://github.com/djbebs/sudoku-world) on November 15, 2026.

## Street View survey layer

In P0.6.6, enable **Relevé Street View** in the left panel, then select a camera or use the panorama/capture selectors. Blue circles represent Google imagery; purple diamonds represent contributor panoramas. The panel provides the original capture, viewer coordinates and heading, imagery date, source URL, and filters by visual building ID and provider. The layer loads on demand and starts off.

The [survey dossier](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/) includes the coverage map, CSV index, evidence and recorded gaps: **55 captures, 24 panoramas, 22 visual IDs, 120 index rows** (116 building associations plus four unassigned captures). The source JSON and evidence are preserved byte for byte. Camera positions outside the 100 m pilot remain accessible.

Coverage is partial. Coordinates and numeric headings are verified as displayed by Google Maps, not as physically accurate camera poses. Contributor headings have no map arrow because geographic alignment is unverified. Visual IDs are not cadastral IDs and are not joined to building meshes. No façade dimensions, building coordinates or textures are inferred from the screenshots. See the dossier for all source limitations and checksums.

The separate P0.6.8 façade experiment is unchanged. To validate the survey assets and layer, run `python tools/validate-streetview-assets.py` and, in `crans-montana-p06/streetview/`, `npm ci` followed by `npm test`.

## Deployment

Under repository Settings > Pages, select **Deploy from a branch**, `main`, `/(root)`.

P0.6.7 opens directly at `/crans-montana-p067/`, with a visible version label and a prominent link on the project home. All earlier release and experiment URLs remain available.

The canonical Ycoor page is `preview-ycoor-design/index.html`. After editing it, run `python tools/build-p067.py` to refresh the release page, then `python tools/build-p067.py --check` to verify that it is current and that its local links, dynamic imports and data-directory references resolve. The generated page uses the same engine, design modules and datasets at their original paths; deploy those shared directories together with the release.
