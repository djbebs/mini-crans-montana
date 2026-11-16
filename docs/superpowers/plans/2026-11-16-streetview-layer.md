# Ycoor Street View survey layer implementation plan

> **For agentic workers:** Use subagent-driven development to implement the independent model, presentation and asset tasks below.

**Goal:** Add the existing 55-view Street View evidence survey as an optional layer in the stable P0.6.6 atlas at `crans-montana-p06/` on the existing `main` branch.

**Architecture:** Keep camera evidence separate from building meshes. A small data adapter derives 24 unique panorama records from unchanged source JSON. An optional Three.js overlay and a French capture panel load on demand; visual-ID filters select evidence, never assign photographs to cadastral geometry.

**Tech stack:** Existing vanilla ES modules and injected Three.js 0.180.0. Node's built-in test runner for data and geometry checks. No production dependency or build-system change.

## Global constraints

- Preserve the stable character, collision, cadastral, terrain and season behavior.
- Leave `preview-p068/` and `feature/p068-facade-windows` untouched.
- Layer defaults off; survey JSON/images load only when requested.
- Preserve 55 capture records, 24 unique panorama IDs, 22 visual IDs and 120 index rows (116 visual associations plus four unassigned captures). Keep opaque IDs and metadata strings unchanged.
- Camera coordinates are viewer-reported; building centroids, identities and exact physical headings remain unverified. No nearest-building joins or photo textures.
- Include outside-pilot camera records. Markers have symbolic, terrain-relative height, not surveyed camera altitude.
- Contributors use a distinct marker and no geographic direction arrow; a selected Google capture may show a labelled viewer-heading arrow.
- Original screenshots retain attribution. Copy shared evidence once; adjust deployed CSV links rather than duplicate building-folder images.

## Review focus

- Zero heading must survive; blank metadata must never become zero or an inferred date.
- Seasons/rebuilds, rapid toggles and hide/show must not destroy or duplicate the overlay.
- Camera pick priority must preserve ordinary atlas selection while layer is off.
- Mobile panel must scroll, close by button/Escape and offer keyboard camera/capture selection.
- Fetch failure must leave the atlas operational and permit retry.

## Tasks

1. Add `streetview/survey-model.js` with real-data regression tests for grouping, filtering, raw metadata preservation, invalid coordinates, conflicts, safe asset paths and heading vectors. Observe failing tests before implementation.
2. Add `streetview/survey-layer.js`, marker rendering and `survey.css`. Provide `createStreetViewLayer(options)` returning an enabled/disabled controller, `pick(raycaster)`, `refreshHeights()` and `dispose()`. The panel exposes visual-ID/source filters, panorama/capture selectors, original imagery, dates, source links and limitations.
3. Package immutable source data, original evidence, CSVs, map and standalone gallery under `assets/streetview-survey/2026-11-15/`. Do not copy authoring tools, node_modules or duplicated image folders. Validate every deployed local path and byte-identical original images.
4. Wire the optional import, control, pick hook and height refresh into stable `index.html`, using existing styles and coordinate conversion. Update source description and README.
5. Run model/geometry tests and existing façade tests, verify the layer in a browser with off/on, filtering, source selection, capture navigation, season rebuild and failure behavior. Review the diff and publish the authorized update to existing `main`, then verify the deployed page.
