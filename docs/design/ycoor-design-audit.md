# Audit de conception — pilote Ycoor du 16 novembre 2026

Périmètre : six volumes intersectant le rectangle pilote de 100 × 100 m. Les poignées CAD ci-dessous sont des identifiants du fichier, pas des numéros cadastraux.

| Volume CAD | Repère visuel | Décision | Preuves principales |
| --- | --- | --- | --- |
| 1A20B | B002, partie centrale | Correspondance visuelle retenue ; aucun détail ajouté | [C005](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C005), C007, C008 |
| 2329F | B002, raccord au coude | Correspondance visuelle retenue ; aucun détail ajouté | [C008](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C008), C012, C051 |
| 2355E | B002, extrémité sud | Correspondance visuelle retenue ; volets et entrée inventoriés pour la suite | [C003](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C003), C026, C027 |
| 2997D | B002, façade Rawyl | Partie commerciale documentée et interprétée en pixel-art | [C055](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C055), C010, C011, C012, C053, C054 |
| 2F7D6 | B003 | Partie nord du front ouest interprétée : vitrages, bois, trois balcons et claustras | [C029](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C029), C030, C026 |
| 26152 | B007 candidat | **Non résolu**, aucune correction de masse ou de statut | [C041](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C041), C042 |

## Première façade

La face nord-ouest `2997D:wall:002` est cohérente avec les vues routières depuis Rawyl et la silhouette du volume à bardage, à côté du long volume voisin. La position et le cap du visualiseur C055 placent son axe près du centre de la partie détaillée ; C010 donne une seconde vue. Cette vérification sert à attribuer une face, pas à revendiquer une pose de caméra physiquement calibrée.

Les observations indépendamment inspectées montrent : vitrage et entrée de boutique, bandeau d’avant-toit bois, bande de bardage et trois baies superposées, ainsi que trois niveaux de balcons sur la partie gauche. Les interfaces Google et certains cadrages masquent une partie du haut. Le pilote n’en déduit pas de nombre total d’étages ni de répétition sur les parties cachées.

Les panoramas rapprochés Go360 de juin 2025 confirment des détails de vitrage et d’entrée. Leurs positions rapportées tombent près/dans le volume voisin sur le plan : **elles ne servent pas à géoréférencer les détails**. Le mur en pierre vu dans le verre est un reflet du mur opposé, pas un parement de la devanture.

Les 19 éléments explicites sont répartis sur la partie commerciale documentée de la face, avec une profondeur et une taille artistiques. Chaque élément porte ses identifiants de captures. Les trois balcons sont placés individuellement ; les barreaux représentent une texture de garde-corps, sans nombre relevé. La surface entière de la face, d’environ 26 m, ne reçoit pas automatiquement le même traitement.

## Deuxième façade — B003, cycle court

La partie nord de `2F7D6:wall:001`, à l’ouest, est documentée par [C030](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C030) et C029 ; C026 situe le retour nord et le passage. Les quatre baies complètes du cadrage ne valent pas dénombrement de toute la façade : une autre baie est coupée à droite. Trois garde-corps superposés, leurs dalles claires, le bois et des claustras verticaux sont directement visibles. Le vitrage derrière le balcon inférieur est partiellement visible ; aucune trame de baies n’est déduite pour les niveaux masqués.

Le cap 90° de C029/C030 ne coupe pas le rectangle de cette face ouest : son axe atteint le retour nord. La façade détaillée apparaît en biais dans l’image. L’attribution repose donc sur le volume et la situation du front de rue, sans prétendre calibrer les pixels avec le cap central. Le plan de face s’étend sur environ 30,85 m, entre H1494,206 et H1510,852 ; le retrait supérieur est un autre plan et ne reçoit pas les détails.

Quinze éléments explicites occupent une partie nord d’environ huit mètres, dimension artistique. Quatre baies, le bois, le vitrage inférieur visible, trois balcons et quatre groupes de lames sont placés individuellement. Altitudes, largeur, profondeur, couleurs et densité des lames/barreaux sont des estimations. La protection rouge au bord du toit paraît temporaire ; elle n’est pas transformée en ornement permanent. Reflets, végétation en pots, voitures et parties cachées sont exclus.

Les mêmes éléments, captures et métadonnées sont réutilisés ; le sélecteur de façade permet d’examiner B003 et Rawyl directement. Les contrôles portent sur les nouveaux placements et la navigation, avec une inspection visuelle finale.

## Écarts et priorités restantes

1. Façade Rawyl : détails absents du niveau de représentation des volumes, traités dans ce pilote. Ce manque de détail ne signifie pas à lui seul que le volume est ancien.
2. B003 : partie nord du front ouest traitée ; retour nord, retrait supérieur et suite du front restent à documenter avant tout ajout.
3. Volume 26152 : confirmer la correspondance B007 et le changement éventuel depuis la source de juin 2020, encore classée en construction.
4. Autre face de B002 / 2355E : volets et entrée visibles, à compléter après un placement documenté.
5. Façades non visibles, détails occultés et bâtiments hors du rectangle : restent en attente de preuves.

## Fidélité géométrique et rendu

Les coordonnées source E/N/H restent inchangées. Les plans de mise en page de façade peuvent regrouper des triangles dont les arrondis CAD produisent des écarts inférieurs à 5 mm ; l’erreur maximale de la face sélectionnée est d’environ 1,62 mm. Ce sont des plans d’implantation approximatifs, pas un aplatissement du bâtiment.

Le contrôle des rectangles utilise les triangles réellement présents. Les trous ou recouvrements non valides sont refusés. Les triangles source exactement coïncidents ne sont affichés qu’une fois, afin d’éviter le scintillement de matériaux ; les 388 faces du fichier source sont conservées dans les données avec la correspondance vers les 351 triangles rendus.

Les dates source géométriques, les libellés d’imagerie (2024 ou 2025) et les horodatages de capture d’écran (novembre 2026) sont conservés séparément. Aucune dimension de façade ni précision GPS physique n’est inventée comme mesure.
