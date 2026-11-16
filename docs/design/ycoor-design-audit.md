# Audit de conception — pilote Ycoor du 16 novembre 2026

Périmètre : six volumes intersectant le rectangle pilote de 100 × 100 m. Les poignées CAD ci-dessous sont des identifiants du fichier, pas des numéros cadastraux.

| Volume CAD | Repère visuel | Décision | Preuves principales |
| --- | --- | --- | --- |
| 1A20B | B002, partie centrale | Correspondance visuelle retenue ; aucun détail ajouté | [C005](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C005), C007, C008 |
| 2329F | B002, raccord au coude | Correspondance visuelle retenue ; aucun détail ajouté | [C008](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C008), C012, C051 |
| 2355E | B002, extrémité sud | Face ouest documentée : deux volets fermés et entrée basse interprétés | [C003](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C003), C026, C027 |
| 2997D | B002, façade Rawyl | Partie commerciale documentée et interprétée en pixel-art | [C055](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C055), C010, C011, C012, C053, C054 |
| 2F7D6 | B003 | Partie nord du front ouest interprétée : vitrages, bois, trois balcons et claustras | [C029](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C029), C030, C026 |
| 26152 | B007 | Correspondance visuelle étayée ; forme finale et état actuel non vérifiés | [C013](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/assets/streetview-survey/2026-11-15/index.html#C013), C014, C017, C018, C022, C041, C042 |

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

## Troisième façade — B002, volets et entrée

Les originaux JPG C003, C026 et C027 ont été inspectés, avec C005 comme vue de contexte du même groupe. La face ouest exacte est `2355E:wall:001`, obtenue avec `createLocalBuildings` et Three à partir des vrais triangles CAD. Sa normale extérieure vaut environ `[-0,99508, 0, 0,09908]`, sa largeur 11,193 m et ses bornes verticales H1493,872–H1512,902. Ces bornes proviennent de la géométrie ; les cotes des détails restent des estimations.

Les coordonnées candidates et le cap 90° du visualiseur C003 donnent une intersection avant avec ce plan à environ 7,513 m de la caméra, à `u=5,082 m`, à l’intérieur de la face. Les axes centraux de C026/C027 passent au-delà de l’extrémité sud (`u≈15,382 m`) : ces captures montrent le retour et le passage vers B003 en biais et servent à confirmer la situation, sans attribuer de fenêtres supplémentaires au mur ouest. Ce contrôle de cohérence ne calibre ni la position physique de la caméra ni les pixels.

C003 montre directement deux fenêtres basses occultées par des volets roulants rouge brun fermés, des bordures et appuis gris, ainsi que l’entrée en retrait à gauche : ombre, bois et jambage en pierre. Dix éléments explicites interprètent ces zones seulement : deux volets, deux bordures, deux appuis et quatre éléments d’entrée. Chaque détail cite C003 ; C026/C027 sont liés à l’observation et à la correspondance de situation. Aucun vitrage n’est inventé derrière les volets fermés, et aucun étage supérieur ou motif répétitif n’est extrapolé sous l’interface ou les balcons.

Les dimensions, teintes, positions, altitudes et profondeurs des détails sont approximatives. Le creux de l’entrée est évoqué par une ombre mince sur le plan source ; le CAD n’est ni creusé ni déplacé. Escalier, voiture, végétation, zones masquées et balcons restent sans ajout dans ce cycle. Les captures et leurs métadonnées originales restent inchangées. Le contrôle réel des trois façades a échoué avec deux changements prêts, puis réussi après l’ajout de cette face ; chaque rectangle est validé contre l’union des triangles de sa face, et les 19 détails Rawyl ainsi que les 15 détails B003 sont conservés.

## Écarts et priorités restantes

1. Façade Rawyl : détails absents du niveau de représentation des volumes, traités dans ce pilote. Ce manque de détail ne signifie pas à lui seul que le volume est ancien.
2. B003 : partie nord du front ouest traitée ; retour nord, retrait supérieur et suite du front restent à documenter avant tout ajout.
3. Volume 26152 : B007 est désormais visuellement étayé par le lien Rawyl–retour–étang. Les vues de 2024 montrent une enveloppe achevée en apparence ; le flux garde la source de juin 2020 classée en construction. La correction de forme et l’état de 2026 restent non résolus ; voir la [vérification détaillée](26152-verification.md).
4. B002 / 2355E : deux volets et entrée basse de la face ouest traités ; étages et parties masquées restent à documenter avant tout ajout.
5. Façades non visibles, détails occultés et bâtiments hors du rectangle : restent en attente de preuves.

## Fidélité géométrique et rendu

Les coordonnées source E/N/H restent inchangées. Les plans de mise en page de façade peuvent regrouper des triangles dont les arrondis CAD produisent des écarts inférieurs à 5 mm ; l’erreur maximale de la face sélectionnée est d’environ 1,62 mm. Ce sont des plans d’implantation approximatifs, pas un aplatissement du bâtiment.

Le contrôle des rectangles utilise les triangles réellement présents. Les trous ou recouvrements non valides sont refusés. Les triangles source exactement coïncidents ne sont affichés qu’une fois, afin d’éviter le scintillement de matériaux ; les 388 faces du fichier source sont conservées dans les données avec la correspondance vers les 351 triangles rendus.

Les dates source géométriques, les libellés d’imagerie (2024 ou 2025) et les horodatages de capture d’écran (novembre 2026) sont conservés séparément. Aucune dimension de façade ni précision GPS physique n’est inventée comme mesure.
