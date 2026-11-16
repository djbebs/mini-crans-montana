# Ycoor Street View survey

Survey date: 15–16 November 2026 (Europe/Zurich)

55 recorded views and documented coverage checks. This is a partial, auditable survey; exhaustive capture of every accessible panorama, historical date and façade has not been established.

Open index.html in a browser for the offline gallery and coverage map. The index contains 55 captures, 24 distinct panorama IDs and 22 survey building IDs. index.csv has 120 rows: 116 nonempty capture/visual-reference associations and four unassigned captures (C009, C015, C024 and C036). Do not count these rows as unique screenshots.

## Evidence and metadata

- evidence/ contains each original captured browser screenshot once. Visual-ID associations share these images; no per-building duplicate folders are deployed.
- index.csv records each capture/visual-reference association or unassigned capture, the original screenshot path, a shared screenshot reference, panorama ID, Street View URL, camera position, heading and visible imagery date.
- buildings.csv describes survey building IDs. These are not cadastral IDs or verified street addresses unless the identity status explicitly says so. S002–S004 represent small potentially movable timber structures, and U-prefixed IDs are unassigned visual volumes with unverified identity. A panorama's address label does not establish the identity or address of a building in its view.
- panoramas.csv gives one row per recorded panorama ID and the map ID (P001 etc.).
- Numeric metadata is copied from the final displayed Street View URL. Latitude and longitude refer to the panorama camera, not a building centroid. Their digits are retained as supplied. Real-world GPS accuracy is unverified.
- heading_deg is the URL's camera-heading parameter, at its recorded precision, clockwise from north. It is the viewing direction, not a façade's compass orientation or a physical camera calibration. url_t_parameter and url_y_parameter retain raw Google URL parameters. No physical vertical or horizontal field of view is verified or implied.
- imagery_date records Google's displayed imagery month and year when available. It is not a screenshot date. A blank field is unavailable or unverified; explicit status columns distinguish it from a real numeric zero.
- Provider and imagery date must be verified per panorama. They must not be inferred from a nearby capture.

## Additional metadata and catalogues

- capture_kind separates façade captures, indoor samples and obstruction checks when provided by the capture registry.
- captured_at_utc and captured_at_europe_zurich record screenshot times, separate from imagery month/year. A blank means unavailable; capture_time_status marks incomplete timestamps.
- exact_physical_heading_status records that exact physical orientation is unavailable or unverified. viewer_direction is a 16-sector label derived from the viewer-reported numeric heading; it does not independently verify geographic orientation.
- building_gps_status is explicit: the recorded latitude/longitude are camera URL coordinates, and building-centroid GPS is unavailable/unverified.
- shop-tour-panoramas.json and gallery-catalog.csv document loaded shop-gallery tiles. The shop gallery catalogue records 32 loaded tiles to the scrollbar bottom. Full views were opened for 4 tiles (Photo 1: C024, Photo 23: C053, Photo 30: C054, Photo 32: C055). Unopened tiles have unverified full-view metadata. Reaching the gallery bottom and sampling these views does not establish that the whole tour was traversed or fully enumerated.
- coverage-gaps.csv lists remaining gaps. It is separate from the index of captured screenshots.

## Coverage map

coverage-map.svg is a schematic geographic plot of viewer URL-reported camera positions with north up. Blue circles identify Google Street View and purple diamonds identify third-party photo spheres. All physical GPS accuracy is unverified. Arrows show viewer-reported headings; physical heading calibration is unverified, especially for third-party spheres. Local equirectangular projection uses mean Earth radius 6,371,008.8 m and the project rectangle centre as its origin. The scale bar is approximate. Heading-ray length is symbolic and does not represent visible range. No building locations, footprints, street geometry, unseen façades or route connectivity have been invented.

The SVG is a schematic camera plot, not a basemap. evidence/coverage-wide-overlay.jpg and evidence/coverage-pilot-overlay.jpg preserve Google coverage-map context at the time of survey; their highlighted lines and dots do not certify exhaustive enumeration or date/façade coverage.

The dashed rectangle is project context only: south 46.310568, west 7.47738, north 46.311508, east 7.47873. Source: https://djbebs.github.io/mini-crans-montana/crans-montana-p06/furniture-source.js?v=3 . These bounds do not verify Street View coverage.

## Coverage and limitations

- Enumeration is incomplete. Recorded road-route views and selected photo-sphere checks do not establish that every accessible panorama or visible façade was captured.
- No full historical-imagery date audit was completed. Historical and third-party images are included only where individually recorded.
- The indoor photo-sphere cluster was sampled. Unvisited indoor nodes, unreached routes and unrecorded dates remain coverage gaps.
- All plotted positions are viewer URL-reported camera locations. Physical GPS accuracy is unverified. Arrows show viewer-reported headings at their recorded precision; third-party sphere orientation calibration is especially unverified.
- S002–S004 identify small potentially movable timber structures. They are visual survey references, not cadastral building identities.
- The shop gallery catalogue records 32 loaded tiles to the scrollbar bottom. Full views were opened for 4 tiles (Photo 1: C024, Photo 23: C053, Photo 30: C054, Photo 32: C055). Unopened tiles have unverified full-view metadata. Reaching the gallery bottom and sampling these views does not establish that the whole tour was traversed or fully enumerated.
- Scope: the project website's approximately 100 × 100 m Ycoor pilot was the core; adjacent Rawyl, Sommets de Crans and eastern Mansfield viewpoints were inspected for sightlines. There is no claim to coverage of all Crans-Montana streets.
- Google road imagery retained here is dated Jun 2024. Separate third-party sources show Feb 2019 (De Douby), Jun 2022 (Dany Gaule), and Jun 2025 (Go360). Dates are the viewer's displayed image-capture labels, never inferred from nearby imagery.
- The Specialized Street View/360 gallery was scrolled to its bottom and 32 loaded tiles catalogued. Four tiles were opened: 1 (indoor), 23 and 30 (exterior Go360), and 32 (Google road). Full metadata for unopened tiles is blank in gallery-catalog.csv. The connected indoor tour was not fully walked or rotated.
- No exhaustive historical-road-imagery date audit or machine-readable global panorama enumeration was available in this workflow. Uncaptured road nodes, routes outside the core, historical dates and unobvious/unlisted photo spheres remain unverified.
- B001 rear/lakeside elevation, complete B003 east/rear/south elevations and the complete B008 complex perimeter were not verified in full. See coverage-gaps.csv for building-specific limits.
- All B, S and U IDs are visual survey references, not official Swiss building/cadastral IDs. Some IDs describe groups or complexes, and U IDs may duplicate another building. No building centroid GPS, official address, dimensions or façade compass bearing is invented.
- The images are original browser screenshots (624 × 667 pixels); Google controls and attribution are preserved. Trees, retaining walls, parked vehicles, Google blur, perspective and viewer controls obscure parts. Screenshots are not orthographic elevations or measurement-grade imagery.
- Latitude/longitude are the camera coordinates in the resolved viewer URL, not building locations. Heading is the viewer's numeric h value (including verified zero when omitted from the compact URL), retained at its exposed precision. Exact physical GPS accuracy and true-north camera calibration are unavailable/unverified, especially in third-party spheres.
- The SVG plots reported camera positions and symbolic heading arrows only. It does not infer footprints, visibility distances or route connectivity. Original Google coverage overlays are included as separate time-of-survey screenshots.
- Observed façades belong to their respective imagery dates; they do not establish November 2026 physical conditions.

## Reuse and integrity

Google attribution is preserved in the evidence screenshots. Imagery remains subject to its owners' rights and terms. The package is an offline record and may differ from future Google Maps content. checksums.sha256 hashes the delivered data, screenshots and generated output files; it does not establish source authenticity or geodetic accuracy.

## Deployment / Déploiement

Read [the bilingual deployment notes](DEPLOYMENT-NOTES.md) for shared image paths, unverified visual identities and the absence of mesh attachment. The deployed [provenance manifest](provenance-sha256.json) distinguishes unchanged source evidence from deployment-only link and documentation changes.
