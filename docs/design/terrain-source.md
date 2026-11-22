# Terrain officiel du pilote Ycoor

La P0.6.7 utilise cette grille embarquée pour le terrain, les surfaces cadastrales, les points d’appui des modèles et le socle. Les triangles des revêtements sont découpés sur ceux du terrain pour éviter les écarts entre les points. Le socle rejoint chaque sommet du périmètre, avec un fond commun placé 3 m sous le point le plus bas. Son contour suit le relief ; les bâtiments et détails restent à leurs altitudes sources.

Les décalages d’affichage sont limités à 0,6 cm pour le remplissage OSM, 1,2 cm pour la couverture du sol MO, 2,4 cm pour les autres surfaces et 3,5 cm pour les lignes MO. L’ancienne élévation de 27 cm et le cadre horizontal ne sont plus utilisés dans cet aperçu. Les anciens modules des versions stables restent inchangés.

Le navigateur charge le JSON local une fois ; un changement de saison ne relance pas le service altimétrique. Si cette grille manque, l’ancien instantané de neuf points sert de secours, dans sa propre emprise et avec une mention visible. Aucun plan incliné n’est prolongé artificiellement hors de la grille connue.

Le fichier `preview-ycoor-design/assets/terrain-grid.json` contient un extrait du modèle **swissALTI3D**, fourni par l’Office fédéral de topographie swisstopo. La [fiche officielle](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) décrit un modèle du terrain sans végétation ni constructions, disponible en grilles de 0,5 ou 2 m et dans le système LV95 / LN02. Nous employons les deux GeoTIFF de 2 m ci-dessous, identifiés par les entrées STAC de l’année **2024**.

L’année provient des identifiants et du champ `datetime` STAC. La valeur `2024-01-01T00:00:00Z` n’établit pas le jour d’acquisition : `observationDate` reste `null`. Les anciennes entrées 2019 du catalogue sont ignorées. Les bâtiments et les surfaces dessinées restent des sources distinctes de ce modèle altimétrique.

## Sources conservées

| Entrée STAC | GeoTIFF officiel | SHA-256 vérifié |
| --- | --- | --- |
| [swissalti3d_2024_2602-1128](https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d/items/swissalti3d_2024_2602-1128) | [2602-1128, 2 m](https://data.geo.admin.ch/ch.swisstopo.swissalti3d/swissalti3d_2024_2602-1128/swissalti3d_2024_2602-1128_2_2056_5728.tif) | `271f51f56a74af8f79f34a224253ff9d8c44fc0ac7072a6704aac39ec285e317` |
| [swissalti3d_2024_2603-1128](https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d/items/swissalti3d_2024_2603-1128) | [2603-1128, 2 m](https://data.geo.admin.ch/ch.swisstopo.swissalti3d/swissalti3d_2024_2603-1128/swissalti3d_2024_2603-1128_2_2056_5728.tif) | `57814e33e3bb54e775776b3c09d104da38a359ed383069b8acb9d5267c9be0ac` |

Le préfixe `1220` du champ STAC `file:checksum` indique un multihash SHA-256 ; les 64 caractères suivants sont comparés à l’empreinte des octets TIFF. Le JSON embarque les URL, les identifiants, ces deux formes d’empreinte, la taille des fichiers et l’empreinte du catalogue brut. Le catalogue mis en cache porte l’horodatage UTC `2026-11-22T16:17:43.790241Z`, conservé dans `retrievedAt`. Il décrit la réponse du catalogue, sans dater la mesure du terrain ni chaque transfert TIFF. La génération et `--check` ne remplacent pas cet horodatage.

## Position des points et altitude

L’origine locale est **E=2603036, N=1128849**. Pour chaque point : `E=origin.e+x`, `N=origin.n-z`. Les hauteurs sont absolues en mètres **LN02 (EPSG:5728)**, avec coordonnées horizontales **LV95 (EPSG:2056)**.

Les deux fichiers sont des rasters float32 de 500 × 500 cellules. Leurs métadonnées vérifiées donnent `ModelPixelScale=(2,2,0)`, `RasterPixelIsArea=1` et un coin supérieur gauche `(2602000,1129000)` ou `(2603000,1129000)`. Le centre du premier pixel est donc un mètre à l’est et un mètre au sud du coin. Les indices de colonnes vont vers l’est ; les indices de lignes vont vers le sud. Aucun point n’est décalé vers une intersection de pixels.

- `xs` : −71, −69, …, 71 ; **72 colonnes**.
- `zs` : −80, −78, …, 90 ; **86 lignes**.
- `heights[ligneZ][colonneX]` : **6 192 valeurs** natives au pas de **2 m**.
- Emprise des centres : E **2602965–2603107**, N **1128759–1128929**. La surface interpolable entre ces centres mesure 142 × 170 m ; les cellules sources débordent chacune de 1 m autour de cette emprise.
- Altitudes exportées : **1495,375–1525,311 m LN02**.

Les altitudes natives sont simplement découpées puis arrondies à **0,001 m** pour réduire le JSON (erreur d’arrondi maximale : 0,0005 m). Cette précision d’écriture ne constitue pas une précision du modèle. Il n’y a ni lissage, ni rééchantillonnage du terrain, ni remplissage de trou. Une valeur NoData, non finie, absente ou couverte par plusieurs tuiles interrompt la génération.

L’origine `x=0,z=0` n’est pas un centre natif en x. `centreHeight=1497.117` m est calculée par interpolation linéaire entre les valeurs float32 des centres `x=-1` et `x=1` sur la ligne native `z=0`, puis arrondie à 0,001 m. Elle sert de référence locale et ne rajoute aucun point au tableau. L’interpolation des deux valeurs déjà arrondies du JSON peut différer de cette référence d’au plus 0,001 m.

## Reproduction et contrôles

Depuis la racine du dépôt, avec Python et Pillow disponibles :

```powershell
python tools/package-terrain.py
python tools/package-terrain.py --check
python -m unittest discover -s tools -p test_package_terrain.py
```

L’exécution normale lit uniquement `../terrain-source-cache/catalog.json` et les deux TIFF. `--cache CHEMIN` et `--output CHEMIN` permettent d’autres emplacements. Les sources TIFF, environ 2 Mo au total, restent hors du dépôt ; seul l’extrait JSON est chargé par le navigateur, sans dépendance ni requête réseau supplémentaire.

Pour remplir explicitement un cache manquant :

```powershell
python tools/package-terrain.py --download
```

Cette option télécharge seulement les fichiers absents, au moyen des deux identifiants 2024 et des empreintes épinglées dans l’outil. Elle ne sélectionne jamais automatiquement un millésime plus récent. Un catalogue recréé reçoit son propre horodatage et son empreinte ; les hauteurs et les empreintes TIFF restent identiques. Pour reproduire exactement tous les octets du JSON publié, conserver le catalogue brut d’origine avec les deux TIFF. `--check` reste hors ligne et compare sans écrire ; il ne peut pas être combiné avec `--download`.

Les huit tests couvrent le demi-pixel, l’orientation nord/sud, la jointure entre tuiles, les trous et chevauchements, NoData et les valeurs non finies, la référence interpolée, les empreintes modifiées et la sélection stricte des entrées 2024.
