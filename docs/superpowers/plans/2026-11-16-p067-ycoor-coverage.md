# P0.6.7 et préparation du secteur Ycoor

> **For agentic workers:** Execute the user-approved short cycle. Root integrates the work, parallel agents own independent bounded files, and one fresh final review checks the completed change.

**Goal:** Publish an accessible P0.6.7, add the photographed B002 lower façade, verify 26152, and prepare every source building/face for later window completion without inventing hidden parts.

**Architecture:** Keep the existing geometry and renderer. Generate the release HTML from the canonical preview with shared module/data paths. Split explicit authored observations/details into one source JSON per building, reconstruct raw capture metadata automatically, and derive a face inventory from the actual source wall planes. A panel and JSON/CSV exports show partial work, unreviewed faces and unknown total window counts.

**Tech Stack:** Existing Three.js 0.180.0, static HTML/CSS/ES modules, Python/Node generation tools, GitHub Pages. No new dependencies.

**Spec:** User explicitly authorized steps 1–3 and preparation to scale to all buildings/windows in the small Ycoor sector. The accepted process is photographs → explicit drawing → preview/correction, with metadata reused automatically. Publish to the existing GitHub repository and add discoverable navigation.

## Constraints

- Preserve all source DXF coordinates, dates, photographs and stable/experimental atlas files.
- Visual IDs are not cadastral identities. Capture dates, imagery dates and geometry source dates remain separate.
- Model only directly supported visible details. All authored dimensions/colors/heights are approximate.
- Finishing the 26152 verification may establish a visual match but must not fabricate a 2026 status or measured roof/height correction.
- Inventory source wall planes, not a claimed count of physical façades. Partial detail does not mean a complete façade; total/remaining window counts stay unknown.
- Per-building authoring and one update/check command must reproduce evidence, inventory and release without rewriting raw survey files.

## Interfaces / ownership

1. Release: root homepage/README, generated `crans-montana-p067/index.html`, `tools/build-p067.py`. Source preview anchors and relative design/assets paths remain stable.
2. B002: authoring/evidence plus existing real-geometry test and audit. Release ownership of those files before source migration.
3. 26152: verification note using original imagery and official data. Root applies only supported metadata decisions after migration.
4. Scalable source: `design/facades/index.json` ordering/policy and six building JSONs; `tools/build-design-evidence.py` produces unchanged schema-1 evidence, including exact raw captures. Compatibility author command calls the builder. `tools/update-ycoor.py` runs evidence → inventory → P0.6.7; `--check` never writes.
5. Inventory: `buildFacadeInventory({buildings,faces,evidence})` and `inventoryToCsv(inventory)` in `design/coverage-model.js`. Summary has buildingCount/faceCount/partialFaceCount/notReviewedFaceCount/blockedFaceCount/detailCount/openingDetailCount/completeFaceCount=0/totalWindowCount=null. Building records contain buildingId/visualIds/matchStatus/sourceDate/sourceUuid/faceIds. Face records contain faceId/buildingId/orientation/status/detailCount/openingDetailCount/totalWindowCount=null/complete=false/changeIds/evidenceIds/candidateCaptureIds/nextAction/canFocus. Status is partial,not_reviewed,identity_unresolved or geometry_ambiguous. No silent face omission, duplicate target or dangling reference.
6. Coverage UI: `createCoverageSection({inventory,onFocusFace,onShowChange,assetBaseUrl})` returns an element. Existing evidence panel gains `showCoverage()` and `view`; focusing a source plane closes the drawer, proof selection returns to the evidence view. Root wires `pilot.focusFace(faceId)` and the new left-side inventory button.

## Tasks / verification

Integration decision: the source inventory also supports `geometry_review` for a visually identified volume whose final measured geometry remains unresolved. An unresolved change with `geometryReviewRequired=true` blocks new ready details on that building but permits inspection of its source planes. Root applies this to 26152 following the documented verification.

- [x] Build a real generated P0.6.7 entry and clear homepage link; verify local paths and release generation/staleness checks.
- [x] Inspect and author B002; RED→GREEN actual face-union/detail checks, preserving existing two façades and raw capture records.
- [x] Verify 26152 against multi-view photos and current official object metadata; record evidence, source dates and remaining uncertainty.
- [x] Migrate per-building sources losslessly; test raw-field preservation, bad refs/duplicates/cross-building targets and stale output detection.
- [x] Derive full face inventory and export CSV/JSON. RED→GREEN coverage tests must include every actual face, unknown totals, unresolved identities, overlapping/invalid targets and CSV escaping.
- [ ] Integrate a readable mobile/desktop inventory panel and source-plane focus. Run affected tests, one-command generation/check, final code review, browser evidence/navigation/download checks, commit/publish, verify live and save a screenshot.

## Review focus

- Three differently oriented photographed faces must attach to the right source planes without repeated hidden rows.
- New inventory must not mark unknown windows or partially modeled faces as complete.
- Every original source wall face must appear once in inventory, including uncertain identity or ambiguous geometry.
- Generated release uses valid shared paths and unambiguous P0.6.7 identity; homepage reaches it directly.
- Metadata source migration must preserve every original capture field, source date and existing detail record, with all generated files current.
