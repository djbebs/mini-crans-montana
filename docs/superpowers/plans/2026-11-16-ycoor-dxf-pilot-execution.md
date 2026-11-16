# Ycoor DXF pilot — steps 1–3 execution

User authorized execution of the three proposed steps: local six-volume geometry, evidence matching and ordered source list, then one documented façade. This execution plan supersedes the earlier plan's planning-only status and adds the verified DXF inputs.

## Decisions

- Work in the existing checkout on `feat/ycoor-dxf-design`, with a separate `preview-ycoor-design/` entry point. Preserve stable `crans-montana-p06/` code/data and `preview-p068/`.
- Reuse stable modules and survey assets by relative URL. The new preview owns its DXF data, renderer and design UI; no duplication of original photographs.
- Preserve official LV95/LN02 geometry: x=E−2603036, z=1128849−N, y=H−terrain-origin-height. No individual building draping or rescaling. The CAD insertion-unit header is ignored in favor of verified metre coordinates.
- Package six full pilot volumes, not the 51MB DXF. Source hashes and geometric UUID matches come from the completed comparison. DXF CAD handles are not cadastral IDs.
- Identify source faces from actual geometry and multiple viewed captures. Unmatched survey groups remain unresolved. Only the documented visible portion of a selected face receives handcrafted pixel-art details, with approximate sizes/positions labelled.
- Default the new preview to local DXF plus supported details. Provide switches for the untouched local baseline, source stream comparison and design additions; preserve original survey viewer.
- Every addition is clickable with original evidence, imagery date, uncertainty and a clear explanation. Never generate a repeated façade grid or copy details to hidden faces.

## Tasks and ownership

1. Local DXF asset/renderer: `preview-ycoor-design/design/local-buildings.js`, `assets/ycoor-dxf.json`, `assets/terrain-snapshot.json`, provenance CSV/JSON, preparation tool and renderer tests. Contract below.
2. Design source/evidence panel: `design/design-inputs.json`, `design/design-panel.js`, `design/design.css`, model helpers/tests. Reads root-owned evidence JSON and geometry metadata; no scene edits.
3. Façade renderer: `design/design-enhancements.js` and meaningful Three.js tests. Draws only explicit detail records on approved local face planes, clipped to the actual triangles and normalized extents. No inferred repetition.
4. Root: inspect source images, identify/map candidate face geometry, write `design/design-evidence.json`, preview index wiring, browser QA, documentation, fresh review and publish the preview after validation.

## Interfaces

`createLocalBuildings({THREE,scene,data,originHeight,onSelect})` -> `{group,meshes,buildings,faces,setVisible(value),setOriginHeight(h),pick(raycaster),dispose()}`. `data.origin={e:2603036,n:1128849}`. Each building has `id` (CAD handle), `sourceUuid`, `sourceDate:{year,month}`, `type`, `vertices` in absolute E/N/H and triangular `faces`. Renderer exposes horizontal outward planar wall groups: `{id,buildingId,origin:[x,y,z],u:[x,y,z],v:[0,1,0],normal:[x,0,z],triangles:[[[u,v],...]],bounds:{minU,maxU,minV,maxV}}` in **absolute H**, with local x/z. Face IDs deterministic. Plane normals oriented outward via building centroid.

`createDesignEnhancements({THREE,scene,changes,faces,originHeight,onSelect})` -> `{group,meshes,setEnabled(value),setOriginHeight(h),pick(raycaster),dispose()}`. Each ready change has `{changeId,buildingId,faceId,status:'ready',evidenceIds,details:[{id,kind,u,v,width,height,depth,color,...}]}`; u/v are face coordinates, v is absolute H. Details are individual explicit records, not row/column generation. Kind support `window`,`shutter`,`door`,`panel`,`balcony`,`beam`,`trim`; support only what explicit data requests. Validate target and all corners within same face triangle union; absent/unready targets render nothing. Primary overlay plane offset outward max0.08m; balcony depth may extend outward if explicit approximation and evidence. Negative/invalid dimensions rejected. Return pick bool and call onSelect(change/detail); disabled objects must not pick. Own/dispose resources; scene group survives terrain rebuilds.

`createDesignPanel({assetBaseUrl,surveyBaseUrl,evidence,onFocusBuilding,onClose,onStatus})` -> `{element,showBuilding(id),showChange(changeId),setOpen(value),dispose()}`. No query params or hidden app state. Panel lists prioritized sources, six geometry targets, evidence matches/remaining unknowns, discrepancies and links to uncropped captures. French labels, existing Pixelify Sans/cream/navy/square-border visual style. Safe textContent/HTTP source links. Root supplies evidence JSON, including sources and matches; optional factory fetch of own design-inputs.json. Links to survey gallery `index.html#Cxxx`, JPGs and source URLs.

## Validation

- Each new behavior begins with a failing unit test. Real Three.js for geometry, visibility/picking and resource disposal; independent fixture examples for plane clipping, zero/unavailable inputs and coordinate frame.
- Verify all six source volumes and original hashes, no invented coordinates, conservative face matching and dates distinct from screenshot timestamps.
- Test preview baseline/design comparison, switch to streamed source, ordinary character/playground controls, season/date rebuilds, keyboard and mobile panel access, and recoverable asset errors.
- Run new tests, existing Street View/preview façade suites and original survey-byte validator once before publication; re-run affected checks only after changes.
- Deliver reviewable preview URL and screenshot, evidence register and source priority list; report any unresolved sides/details.
