# Ycoor — atelier DXF et façades documentées

[Ouvrir la prévisualisation](https://djbebs.github.io/mini-crans-montana/preview-ycoor-design/) · [Version stable](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/) · [Relevé original](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/)

Cette base de travail alimente la [P0.6.7](../crans-montana-p067/), accessible depuis l’accueil. Elle réunit six volumes DXF locaux et trois parties de façades documentées : Rawyl (19 éléments), B003 (15) et la face ouest basse de B002 / 2355E (10), soit 44 éléments explicites.

## Utilisation

- **Détails documentés : ON/OFF** compare l’interprétation au volume local sans ajouts.
- **Façade à voir** choisit l’une des trois parties documentées et la cadre directement. Le bouton **Voir la façade choisie** permet de la retrouver après un déplacement. La dernière façade ajoutée s’ouvre au démarrage.
- **Inventaire des bâtiments** présente les six volumes et tous leurs plans de murs sources. Chaque face peut être cadrée et les preuves des détails appliqués restent accessibles. Les exports JSON/CSV préparent le travail par lots.
- Cliquer un détail ouvre **Pourquoi ce détail ?**, avec ses photographies, dates et estimations.
- **Sources et preuves** présente les sept entrées par priorité, les six correspondances géométriques et la liste des écarts à examiner.
- Le bouton **DXF / Flux** compare les volumes locaux au service swisstopo ; les ajouts sont masqués pendant l’affichage du flux.
- **⌂** revient à la vue d’ensemble. Les commandes de saison, jeux et personnages restent celles de P0.6.6.

## Sources et limites

Le fichier local `assets/ycoor-dxf.json` conserve les **226 sommets et 388 triangles source** des six volumes sélectionnés dans la tuile officielle 1287-13. Seuls les triangles exactement coïncidents sont regroupés pour l’affichage (351 triangles rendus), avec conservation de la relation vers les faces source. Aucune coordonnée source n’est déplacée ni mise à l’échelle. Les grandes coordonnées LV95 sont recentrées et les hauteurs conservées par rapport à l’origine de terrain.

L’édition DXF est mai 2024. Les dates source des géométries correspondantes, issues des métadonnées du flux, sont juin 2016 (quatre volumes), juin 2017 (un), juin 2020 (un). Ces dates sont distinctes des dates de publication et de téléchargement. L’instantané officiel du relief contient neuf réponses API, avec leurs URL et heures de récupération ; leur date d’observation, leur modèle précis et leur référentiel vertical ne sont pas fournis par ces réponses.

Les 19 éléments de la façade pilote sont des **interprétations pixel-art** : dimensions, niveaux, couleurs, profondeurs et densité des barreaux sont approximatifs. Le mur de pierre reflété dans les vitrines n’est pas reproduit comme un mur opaque. Le lettrage de l’enseigne n’est pas restitué. La partie restante de la façade et les autres côtés ne sont pas complétés par répétition.

La deuxième façade, B003 / `2F7D6:wall:001`, reprend quatre baies complètes visibles, un encadrement bois, le vitrage partiel derrière le balcon inférieur, trois garde-corps et leurs dalles, ainsi que des claustras verticaux. Ses 15 éléments occupent environ les huit premiers mètres du front ouest, comme choix de composition approximatif. Les altitudes des détails et les densités de barreaux/lames ne sont pas mesurées. La protection rouge temporaire au bord du toit, les reflets et le reste du bâtiment ne sont pas ajoutés. Le cap central des captures vise le retour nord : la face ouest est attribuée par son contexte visible en biais, sans calibration métrique.

B002 est un groupe visuel couvrant plusieurs volumes CAD. Les correspondances ne valent pas identification cadastrale. La vérification multi-vues de 26152 étaye désormais B007 : les parties observées paraissent achevées en juin 2024, alors que le flux courant conserve une source de juin 2020 classée `Im Bau`. La forme finale, les hauteurs et l’état en 2026 ne sont pas vérifiés ; ses faces restent en attente d’une vérification géométrique avant ajout de fenêtres. Voir la [vérification détaillée](../docs/design/26152-verification.md), le [registre de preuves](design/design-evidence.json), la [provenance DXF](assets/dxf-provenance.json) et l’[audit de conception](../docs/design/ycoor-design-audit.md).

## Développement et contrôles

Le cycle court : **choisir une face documentée → modifier le fichier du bâtiment → examiner l’aperçu**. Les six fichiers de `design/facades/` contiennent les correspondances, observations et détails explicites. `index.json` donne leur ordre. Les métadonnées originales sont reprises automatiquement. `python tools/update-ycoor.py` reconstruit les preuves, contrôle les placements, exporte l’inventaire et met à jour la P0.6.7 ; `--check` vérifie les sorties sans écrire. Voir le [guide du secteur](../docs/design/facade-workflow.md).

L’inventaire couvre 43 plans de murs du modèle, pas 43 façades physiques complètes. Trois sont partiellement dessinés ; aucun n’a un relevé exhaustif validé. Le nombre total de fenêtres et le reste à dessiner sont inconnus. Le comptage des composants dessinés (fenêtres, vitrages, portes ou volets) ne vaut pas dénombrement de fenêtres physiques uniques.

Dans `preview-ycoor-design/design/` : `npm ci`, puis `npm test`.

Les tests couvrent les coordonnées, le changement d’origine verticale, les normales et groupes de faces, les arrondis CAD proches de la verticale, les doubles triangles de toiture, les détails explicitement placés, le refus des trous/recouvrements, les références photographiques, la sélection et la libération des ressources. Les géométries et preuves d’origine restent immuables.

`tools/package-ycoor-dxf.py` prépare les petits fichiers à partir des archives et analyses locales de comparaison ; `--fetch-terrain` renouvelle explicitement l’instantané des neuf hauteurs. Ces analyses et archives sont des prérequis locaux, hors dépôt. `tools/author-ycoor-evidence.py` reste un raccourci compatible vers le constructeur du registre. Aucun outil ne génère de fenêtres sur des faces inconnues.
