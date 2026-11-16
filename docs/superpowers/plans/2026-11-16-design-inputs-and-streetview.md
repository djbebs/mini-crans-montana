# Design inputs and Street View enrichment implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkboxes for tracking.

**Goal:** Make the Ycoor Street View survey an explicit design input for completing missing visual detail and investigating potentially outdated features in the stable P0.6.6 atlas, with an ordered, clickable source list.

**Architecture:** Maintain an official geographic baseline and a separate, evidence-backed set of design additions. A source registry explains what each input controls. Every addition links to its observation, date, building/face match and uncertainty; source records remain immutable.

**Tech Stack:** Existing vanilla JavaScript, JSON, Three.js 0.180.0 and Node's test runner. No additional production dependencies.

**Spec:** User clarification of 16 November 2026: the Street View survey should be an input for designing features missing or old in official sources; provide a linked input list in priority order. This deliverable is a plan only. Application changes and publication are not part of this planning turn.

## Priority-ordered inputs

Priority describes the design review workflow. Authority is decided per attribute: an appearance reference never becomes a measured position simply because it is higher in this table.

| Priority | Input | Use and current status |
| --- | --- | --- |
| 1 | [Valais official survey / MO](https://sit.vs.ch/arcgis/rest/services/MO/MapServer) | Baseline for surveyed ground surfaces and fixed features; building footprint cross-check. Currently renders layers 270, 180 and 190. Layer 260 supplies counts only; footprint geometry must be requested and verified before using it for building matching. |
| 2 | [swisstopo building 3D tiles](https://docs.geo.admin.ch/visualize-data/3d-tiles.html) / [current atlas tileset](https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/20260520/tileset.json) | Baseline for building volumes and roofs. Current revision is 20260520, fallback 20251121. These package identifiers do not establish the observation date of a particular Ycoor building. |
| 3 | [Ycoor Street View survey](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/) / [index](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.csv) | Main detailed reference for visible façades: window arrangements, balconies, doors, shopfronts, cladding, colours and small visible structures. Currently a viewer only; proposed design use is new. Contains 55 captures / 24 panoramas. Imagery labels span February 2019 to June 2025; screenshots were recorded on 15–16 November 2026. |
| 4 | [Ycoor tourism photographs](https://www.crans-montana.ch/fr/?idcmt=Partenaire_Activite_4ff811345b2094222f969b680bb9ac78) and [approved playground model references](https://github.com/djbebs/mini-crans-montana/blob/main/crans-montana-p06/photo-playground.js) | Reference for visible playground equipment and appearance. The page labels some photographs 2025, but exact per-image acquisition dates are not ingested. Approved prefabs are illustrative, with approximate dimensions and placement. A clearer, reliably newer photograph of the same feature can take precedence over Street View for that feature. |
| 5 | [OpenStreetMap around Ycoor](https://www.openstreetmap.org/#map=19/46.311036/7.478052) | Mapped playground perimeter, pedestrian paths, equipment and furniture positions where official inputs do not supply them. Current query does not fetch building footprints or trees. Map retrieval time is not an object's observation date. |
| 6 | [swisstopo point-height service](https://docs.geo.admin.ch/access-data/get-point-height.html) / [pilot-centre request](https://api3.geo.admin.ch/rest/services/height?easting=2603036&northing=1128849&sr=2056) | Official terrain-height input, currently sampled at nine points and interpolated. The app does not record its observation date or identify the returned model; do not claim full-resolution swissALTI3D ingestion. Lower workflow priority does not lower its authority for terrain heights. |
| 7 | [swisstopo vegetation 3D tiles](https://3d.geo.admin.ch/ch.swisstopo.vegetation.3d/v1/20250728/tileset.json) | Baseline for mapped vegetation volumes. Revision identifier 20250728 is not a verified observation date for each tree. Photos may flag changes for review. |

The VSGIS and swisstopo comparison viewers are reference links, not additional data feeds consumed by this scene. User-supplied character GLBs are artistic assets, not observations of real people or physical site features.

## Global constraints

- Preserve the stable P0.6.6 geographic baseline and original survey JSON/JPG/TXT files.
- Leave the P0.6.8 experiment unchanged; any useful renderer pattern requires independent validation before reuse.
- Distinguish `missing_detail`, `dated_change_supported` and `unresolved`. A blank official façade may reflect its level of detail rather than age.
- Compare observation dates for the same feature. Fetch dates, release dates and screenshot dates do not prove which physical state is newer.
- Survey B/S/U IDs remain visual references until a building and specific face are explicitly matched. Do not match by proximity alone or assume one visual group is one cadastral building.
- Unknown dates, dimensions, physical headings and hidden surfaces remain unknown. Camera coordinates are not building coordinates.
- Handcrafted pixel-art geometry may express supported visible detail; inferred ratios/dimensions are labelled approximate. Do not copy details onto unseen sides.
- A material contradiction about position, height or building existence becomes a documented proposed correction. Do not silently rewrite the official baseline.

## Review focus

- A 2026 screenshot of June 2024 imagery must not be treated as a 2026 observation.
- An unresolved visual-to-building or face match must prevent rendering an addition on a guessed target.
- One visible window or balcony arrangement must not propagate to unseen façades.
- Empty/failed evidence loading must leave the atlas operational; toggling additions must restore the baseline.
- Small/mobile screens must retain usable source links and full capture access; no image crop should hide attribution.

## Implementation tasks

### Task 1: Ordered source register and atlas source list

**Files:** Create `crans-montana-p06/design/design-inputs.json`, `design-inputs.js`, `design.css`, and `design/tests/design-inputs.test.mjs`. Modify the existing source panel in `crans-montana-p06/index.html` and project documentation.

**Interfaces:** `loadDesignInputs(url)` returns source records with `sourceId`, `priority`, `label`, `url`, `uses`, `limitations`, `status`, `revision`, `observedAt` and `retrievedAt`. Unknown dates are null. `renderDesignInputs(container, sources)` produces the French list “Entrées de conception · Sources”.

- [ ] Write failing tests asserting the seven-source order, Street View's explicit design role, HTTPS links and preservation of null observation dates.
- [ ] Run the tests and confirm the intended failures, then implement the registry and validated loader.
- [ ] Render the linked source list with each input's purpose, date meaning and current/proposed status; retain the capture dossier link.
- [ ] Verify tests and browser links, keyboard use and narrow-screen layout; commit the independently reviewable source-list change.

### Task 2: Evidence register and discrepancy audit

**Files:** Create `crans-montana-p06/design/design-evidence.json`, `design-evidence.js`, `design/tests/design-evidence.test.mjs` and `docs/design/ycoor-design-audit.md`.

**Interfaces:** `validateDesignEvidence(data, {sources, captures})` returns validated `buildingMatches`, `observations` and `changes`, or throws explicit errors. Each change identifies `changeId`, target building/face, affected attribute, source/capture links, actual observation date or null, confidence, discrepancy class, proposed treatment and decision state. Coordinates/dimensions and their evidence status are separate fields.

- [ ] Write failing tests for missing capture IDs, unverified target matches, date conflation and attempts to interpret camera coordinates as building coordinates.
- [ ] Implement validation without changing the immutable survey. Verify dates against raw JSON strings rather than automatic local-time conversions.
- [ ] Inspect individual captures and official geometry to establish building/face matches. Start with the most relevant pilot façades; B002, B003 and B001 are candidates for audit, not pre-approved mesh assignments.
- [ ] Produce a prioritized missing-detail/change list with direct evidence links. Use [C003](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C003), for example, as a candidate B002 reference, while retaining its recorded occlusions and June 2024 date.
- [ ] Mark conflicts and unmatched cases unresolved. Confirm all tests and evidence links before committing the audit.

### Task 3: Small pilot of evidence-backed design additions

**Files:** Create `crans-montana-p06/design/design-enhancements.js`, `design/tests/design-enhancements.test.mjs`; update the validated evidence records and stable atlas wiring.

**Interfaces:** `createDesignEnhancements({THREE, scene, changes, resolveVerifiedFace})` returns `setEnabled(boolean)`, `refreshHeights()` and `dispose()`. `resolveVerifiedFace(match)` supplies a verified target face or null; null suppresses rendering. Only changes marked `ready` may render.

- [ ] Write failing tests proving unresolved matches, unsupported dimensions and hidden-side duplication do not render; verify reversible toggling and resource disposal.
- [ ] Implement a separate group for a small set of supported façade details, initially windows/doors, balconies and cladding/colour where the evidence supports them.
- [ ] Preserve baseline position, footprint, volume and terrain. Record each artistic approximation explicitly.
- [ ] Add a click-through “Pourquoi ce détail ?” explanation showing the evidence image, source date, reasoning and uncertainty.
- [ ] Compare baseline versus enriched views in the browser, including seasons and normal camera controls; run the relevant tests and commit the pilot.

### Task 4: Review and publication

- [ ] Review the pilot side by side with every supporting capture; reject unsupported claims of recency, dimensions or complete façade coverage.
- [ ] Run source/evidence/enhancement tests, existing Street View and façade suites, link checks and original survey checksum validation.
- [ ] Publish only the reviewed source register and supported additions; record unresolved discrepancies for later work.
- [ ] Verify the deployed source list, original evidence links, baseline/enriched comparison and failure fallback.

## Acceptance criteria

- The atlas shows an ordered, clickable list explaining every physical design input, including Street View.
- Street View supports actual documented design decisions beyond its existing capture viewer.
- Every rendered addition can be traced to a visible observation and a verified target; approximate values are clearly labelled.
- Official geometry and source bytes remain auditable; “old” is claimed only when feature-level dated evidence supports it.
- Unsupported or conflicting features remain on the to-verify list rather than becoming invented geometry.

## Planning status

This file records the proposed work. No source-list UI, building matching or design enrichment has been implemented or deployed in this planning turn.
