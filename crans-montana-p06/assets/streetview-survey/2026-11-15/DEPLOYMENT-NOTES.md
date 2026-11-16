# Notes de déploiement / Deployment notes

## Français

Ce dossier contient les 55 captures originales de l'enquête Ycoor des 15–16 novembre 2026, 24 identifiants de panoramas et 22 repères visuels. Les 120 lignes de l'index comprennent 116 associations à un repère et quatre captures non assignées (C009, C015, C024 et C036), pas 120 photographies différentes.

Tous les identifiants B, S et U sont des repères visuels non vérifiés. Ils ne sont pas des identifiants cadastraux et aucun n'est rattaché à un maillage du Pixel Atlas. Les coordonnées sont celles de la caméra rapportées par l'URL du visualiseur, jamais celles d'un bâtiment. La précision physique du GPS et l'étalonnage du cap par rapport au nord vrai restent non vérifiés, particulièrement pour les sphères de contributeurs.

Chaque capture est stockée une seule fois dans `evidence/`. Dans `index.csv`, les colonnes `screenshot` et `building_screenshot` pointent vers ce même fichier partagé. Les 120 lignes sont conservées. Les JPG et les fichiers TXT d'origine sont identiques, octet pour octet, aux preuves de l'enquête. Le JSON source est inchangé. La galerie autonome, le fichier SVG et le présent guide sont adaptés uniquement pour les liens de déploiement et l'absence de copies par bâtiment.

L'enquête est partielle. Les dates historiques n'ont pas été auditées intégralement et la visite intérieure n'a pas été parcourue entièrement. Le catalogue contient 32 vignettes chargées; seuls quatre panoramas ont été ouverts. Consultez [les lacunes](coverage-gaps.csv), [le catalogue](gallery-catalog.csv) et [la méthode](README.md). Les surlignages des cartes Google sont un contexte au moment de l'enquête, pas une preuve d'exhaustivité. Les captures conservent les mentions d'attribution visibles.

## English

This folder contains the 55 original captures from the 15–16 November 2026 Ycoor survey, 24 panorama IDs and 22 visual references. The index has 120 rows: 116 nonempty capture/reference associations and four unassigned captures (C009, C015, C024 and C036), not 120 distinct photographs.

All B, S and U IDs are unverified visual references. They are not cadastral IDs and none is attached to a Pixel Atlas mesh. Coordinates are camera locations reported by the viewer URL, never building coordinates. Physical GPS accuracy and true-north heading calibration remain unverified, especially for contributor spheres.

Each capture is stored once under `evidence/`. Both `screenshot` and `building_screenshot` in `index.csv` resolve to that shared file; all 120 rows remain. Original JPG and TXT evidence is byte-identical to the survey source. Source JSON is unchanged. The standalone gallery, SVG and documentation are adapted only for deployment links and the absence of per-building image copies.

The survey is partial. Historical dates were not fully audited, and the indoor tour was not fully traversed. The catalogue contains 32 loaded tiles; only four full panoramas were opened. See [coverage gaps](coverage-gaps.csv), [gallery catalogue](gallery-catalog.csv) and [method](README.md). Google coverage highlights provide time-of-survey context, not proof of exhaustive enumeration. Visible attribution remains in the original captures.

## Provenance / Provenance

[provenance-sha256.json](provenance-sha256.json) records each deployed file's SHA-256 hash, original source hash when applicable and any deployment-only transformation. [checksums.sha256](checksums.sha256) hashes the deployed payload plus the provenance record. Neither manifest claims source authenticity, calibrated positioning or verified building identity.
