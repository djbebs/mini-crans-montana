# P0.6.8 experimental windows

Feature branch only. This is not a production release.

## Current scope
- OFF by default; stable P0.6.6 scene, characters and collision code unchanged.
- Procedural mode uses estimated windows extracted from loaded official 3D tile façade triangles.
- Hybrid mode currently has no verified landmarks and produces the same estimates as procedural mode.
- No documented photo-verified landmark source is available; source and override registries are deliberately empty.
- OSM fallback buildings are not decorated yet.
- Streaming tile LOD transitions and camera performance require real browser validation.
- Tiles may include multiple buildings. Stable building IDs and official window locations are not assumed.
- If extraction fails, the source building remains rendered without added detail.

## Tests
Run: cd crans-montana-p06/facade && npm test (Node 20+).
Unit tests cover projections, deterministic generation and OFF-by-default behaviour. They do not replace browser validation.

## Provenance
swissBUILDINGS3D supplies the existing building meshes, not surveyed window positions. All generated windows are unverified artistic estimates. A reviewed photograph, source URL, permission review and reliable building match are required before enabling a verified override.

## Rollback
Choose OFF in the selector. Do not merge until visual browser checks, streaming lifecycle checks and performance tests pass.
