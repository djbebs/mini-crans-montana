# B007 · reconstitution visuelle estimée

Ajoutée le 23 novembre 2026 à la P0.6.7. Le volume entouré par l’utilisateur correspond au repère visuel B007 et au volume source 26152. Il existe dans la base utilisée, mais sous une forme basse et schématique. La reconstitution photographique donne maintenant sa silhouette à trois pignons, son bardage sombre, ses zones vitrées côté Rawyl et ses balcons sur l’étang.

## Vérification officielle

Le [manifeste courant](https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json) renvoie toujours au paquet 20260520. La tuile `11/686/509.b3dm` est identique à celle contrôlée précédemment : SHA-256 `777a1c638d03472d058a620d0743b4558b795bf0af3ae368a302f6e473fe9962`. Le statut `Im Bau` et la provenance de juin 2020 restent ceux de l’objet source, pas un état de chantier constaté en 2026.

L’[archive détaillée swissBUILDINGS3D 3.0 de la tuile locale, millésime 2020](https://data.geo.admin.ch/ch.swisstopo.swissbuildings3d_3_0/swissbuildings3d_3_0_2020_1287-13/swissbuildings3d_3_0_2020_1287-13_2056_5728.gdb.zip) a également été ouverte. Son SHA-256 `c5f524fe9a6eb538bb9db3441e0e77ed837506c56b6fc2c2effa217810499920` correspond au catalogue. Ses couches `Building_solid`, `Wall`, `Roof` et `Floor` ont été décodées. La couche Roof conserve le plan horizontal à environ 1506,133 m sur cette zone ; les polygones plus hauts près du raccord appartiennent au voisin. Cette donnée ne fournit donc pas la toiture finale visible dans les photographies.

## Preuves photographiques

Dans le dossier partagé du relevé :

- [B007-N016](../../crans-montana-p06/assets/streetview-survey/2026-11-15/evidence/2026-11-23/B007-N016.jpg) : Google, juin 2024, front Rawyl entier ; trois loggias hautes sous les pignons, trois rangées résidentielles et rez commercial/fermeture sombre.
- [B007-N017](../../crans-montana-p06/assets/streetview-survey/2026-11-15/evidence/2026-11-23/B007-N017.jpg) : sphère Dany Gaule, juin 2022 ; relief des balcons et soubassement, haut fortement flouté. Le cap géographique n’est pas calibré.
- [B007-N018](../../crans-montana-p06/assets/streetview-survey/2026-11-15/evidence/2026-11-23/B007-N018.jpg) : Google, juin 2024, autre rive ; trois travées à pignons et six bandes de balcons superposées, niveau supérieur inclus, au-dessus du soubassement.

C013/C014/C017/C018/C022/C041/C042 apportent les recoupements antérieurs. Les fichiers originaux et les cinq captures complémentaires précédentes sont conservés. Le [CSV complémentaire](../../crans-montana-p06/assets/streetview-survey/2026-11-15/supplement-index.csv) contient les URL, dates affichées, coordonnées de caméra, caps du visualiseur et leurs limites. Aucun cap physique exact ni GPS de bâtiment n’est affirmé.

## Ce qui est estimé

L’emprise horizontale reprend les triangles sources, y compris leurs décrochements au raccord. Le socle inférieur à 1493,872 m provient du DXF : ce n’est pas une mesure du sol visible. Les égouts à 1517,8 m et les faîtages à 1520,2 m sont des **choix artistiques**, à partir des proportions des images et du voisinage. Aucune précision métrique ni marge d’erreur chiffrée ne peut leur être attribuée.

Les niveaux, dimensions des ouvertures, projections des balcons, teintes, loggias et motifs de bardage sont également interprétés. Les 71 composants constituent une représentation stylisée des zones visibles, pas 71 fenêtres ni un recensement exhaustif. Le côté mitoyen et les ouvertures masquées restent inconnus. Les bandes vitrées regroupent des zones lisibles sans prétendre compter leurs vitrages. L’état physique de novembre 2026 n’est pas déduit des dates de capture.

## Conservation et usage

Le fichier officiel `assets/ycoor-dxf.json`, ses six volumes, leurs attributs et l’indicateur `geometryReviewRequired` de 26152 sont inchangés. L’inventaire des plans officiels conserve donc ses quatre plans à vérifier. Les 220 composants sur géométrie officielle sont distincts des 71 composants du modèle photo.

La source d’édition est `design/reconstructions/26152.json`. `tools/build-b007-reconstruction.py` génère `design/photo-reconstruction.json`, chargé comme interprétation facultative. La correspondance UUID et les limites du volume source sont contrôlées avant affichage ; une évolution incompatible de la source entraîne le maintien du DXF.

Le bouton **Voir B007 reconstitué** cadre ce bâtiment. **Détails documentés : OFF** rétablit exactement le volume officiel. Le mode de comparaison avec le flux officiel masque également la reconstitution. Son absence ou une erreur de validation laisse les autres bâtiments utilisables. Les objets masqués ne participent pas à la sélection ; les ressources sont libérées avec le reste de la scène.

Une seule commande, `python tools/update-ycoor.py`, reconstruit ce modèle, les index du relevé, les preuves, l’inventaire et la page publiée. La publication doit conserver les deux sources distinctes jusqu’à l’obtention d’une géométrie finale datée et mesurée.
