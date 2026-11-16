# Ycoor — atelier DXF et façades documentées

[Ouvrir la prévisualisation](https://djbebs.github.io/mini-crans-montana/preview-ycoor-design/) · [Version stable](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/) · [Relevé original](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/)

Cette prévisualisation réalise les étapes autorisées : six volumes DXF locaux, une liste de sources cliquables avec des correspondances et écarts documentés, puis une première partie de façade conçue à partir des observations Street View. La version stable et l’expérience P0.6.8 sont conservées.

## Utilisation

- **Détails documentés : ON/OFF** compare l’interprétation au volume local sans ajouts.
- **Voir la façade pilote** cadre la devanture sur Rawyl. Les côtés non documentés restent sans ajout.
- Cliquer un détail ouvre **Pourquoi ce détail ?**, avec ses photographies, dates et estimations.
- **Sources et preuves** présente les sept entrées par priorité, les six correspondances géométriques et la liste des écarts à examiner.
- Le bouton **DXF / Flux** compare les volumes locaux au service swisstopo ; les ajouts sont masqués pendant l’affichage du flux.
- **⌂** revient à la vue d’ensemble. Les commandes de saison, jeux et personnages restent celles de P0.6.6.

## Sources et limites

Le fichier local `assets/ycoor-dxf.json` conserve les **226 sommets et 388 triangles source** des six volumes sélectionnés dans la tuile officielle 1287-13. Seuls les triangles exactement coïncidents sont regroupés pour l’affichage (351 triangles rendus), avec conservation de la relation vers les faces source. Aucune coordonnée source n’est déplacée ni mise à l’échelle. Les grandes coordonnées LV95 sont recentrées et les hauteurs conservées par rapport à l’origine de terrain.

L’édition DXF est mai 2024. Les dates source des géométries correspondantes, issues des métadonnées du flux, sont juin 2016 (quatre volumes), juin 2017 (un), juin 2020 (un). Ces dates sont distinctes des dates de publication et de téléchargement. L’instantané officiel du relief contient neuf réponses API, avec leurs URL et heures de récupération ; leur date d’observation, leur modèle précis et leur référentiel vertical ne sont pas fournis par ces réponses.

Les 19 éléments de la façade pilote sont des **interprétations pixel-art** : dimensions, niveaux, couleurs, profondeurs et densité des barreaux sont approximatifs. Le mur de pierre reflété dans les vitrines n’est pas reproduit comme un mur opaque. Le lettrage de l’enseigne n’est pas restitué. La partie restante de la façade et les autres côtés ne sont pas complétés par répétition.

B002 est un groupe visuel couvrant plusieurs volumes CAD. Les correspondances ne valent pas identification cadastrale. Le volume 26152, encore classé `Im Bau` par la source, conserve une attribution visuelle **à vérifier** ; sa hauteur et son statut ne sont pas modifiés. Voir le [registre de preuves](design/design-evidence.json), la [provenance DXF](assets/dxf-provenance.json) et l’[audit de conception](../docs/design/ycoor-design-audit.md).

## Développement et contrôles

Dans `preview-ycoor-design/design/` : `npm ci`, puis `npm test`.

Les tests couvrent les coordonnées, le changement d’origine verticale, les normales et groupes de faces, les arrondis CAD proches de la verticale, les doubles triangles de toiture, les détails explicitement placés, le refus des trous/recouvrements, les références photographiques, la sélection et la libération des ressources. Les géométries et preuves d’origine restent immuables.

`tools/package-ycoor-dxf.py` prépare les petits fichiers à partir des archives et analyses locales de comparaison ; `--fetch-terrain` renouvelle explicitement l’instantané des neuf hauteurs. Ces analyses et archives sont des prérequis locaux, hors dépôt. `tools/author-ycoor-evidence.py` reproduit le registre des estimations explicites à partir des captures originales déjà publiées. Aucun de ces outils ne génère de fenêtres sur des faces inconnues.
