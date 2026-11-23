# Jardin d’Ycoor : jeux et animations

P0.6.7 remplace la composition générique de cinq modèles par sept équipements liés à des vues attribuables. La disposition relative, les dimensions et les orientations sont des estimations artistiques ; l’état actuel en novembre 2026 n’est pas confirmé.

## Références et priorité

1. **Aspect des mêmes équipements** : [galerie de Crans-Montana Tourisme](https://www.crans-montana.ch/fr/?idcmt=Partenaire_Activite_4ff811345b2094222f969b680bb9ac78), photographies de Maxime Aliaga libellées 2025. Ce libellé ne donne pas une date d’acquisition vérifiée. Les images montrent notamment le portique jaune à nacelle bleue, le double cône de cordes, le parcours en rondins, la structure rouge/bois et les jeux à ressort.
2. **Disposition et contexte** : [sept captures supplémentaires](../../preview-ycoor-design/assets/playground-evidence/2026-11-23/references.json), photosphère Dany Gaule de juin 2022 et Street View Google de juin 2024. Les positions et caps sont ceux du visualiseur, sans calibration physique certifiée. Les deux portiques orange de 2022 servent au contexte, pas à imposer leur ancienne couleur aux photos libellées 2025.
3. **Emprises** : [polygone OSM way/245072857](https://www.openstreetmap.org/way/245072857) et surface MO Valais 270/362488. L’emprise cadastrale reste identique ; une couche d’aspect vert issue des photos remplace visuellement le beige conventionnel de « Autre revêtement dur ». Le type précis de revêtement n’est pas mesuré. Les chemins et l’étang restent en dehors de l’emprise des équipements et des parcours testés.

Les captures originales du relevé de façades restent intactes. Les images touristiques sont référencées par leurs URL et crédits ; aucune texture photographique n’est plaquée sur les modèles.

## Modèles et contacts

| Équipement | Repères visuels | Animation |
|---|---|---|
| Ensemble bois/rouge avec pont de cordes | P002, P007 ; photos 13 et 15 | Escalier, pont, glissades assises, sur le dos ou sur le ventre ; parfois un saut de joie après la réception |
| Double cône de cordes avec anneau | P005 ; photo 11 | Montée et descente sur les niveaux effectivement dessinés |
| Parcours en rondins | Photo 15 | Marche en équilibre sur les poutres |
| Portique sud | P003, P006 ; photo 22 | Balançoire simple ; adulte qui approche, donne trois poussées synchronisées puis reste sur le côté pour surveiller. Forme actuelle du siège peu lisible, simplifiée |
| Portique nord à nacelle bleue | Photo 17 ; P003 | Enfant assis, nacelle et suspentes synchronisées |
| Jeu jaune à deux sièges | Photo 22 | Deux enfants assis, oscillation commune du jeu |
| Petit jeu sombre sur ressort | Photo 22 | Bascule assise synchronisée |

Les silhouettes partielles d’autres petits équipements visibles en arrière-plan ne sont pas extrapolées. Le nombre de modèles ne prétend donc pas être un inventaire exhaustif des jeux présents aujourd’hui. Les limites et identifiants de preuves figurent aussi dans les métadonnées des objets.

## Réutilisation

`playground-models.js` sépare les sept placements du site et les constructeurs de jeux. Les modèles n’apparaissent que dans le polygone Ycoor attendu ; une frontière incompatible supprime le placement plutôt que de redistribuer les jeux au hasard. Les pièces statiques sont regroupées par couleur pour réduire les appels de dessin. Les sièges mobiles gardent leur propre groupe.

Le moteur de personnages reste commun aux secteurs : chaque jeu fournit ses contacts, ses parcours et ses volumes interdits. Un rappel `onPose` applique au siège le même instant d’animation que celui de l’enfant. Les suspentes de la balançoire simple rejoignent les bords du siège. Le bassin des vrais GLB sert de point de contact, en tenant compte de leur taille ; leurs jambes s’étendent devant le siège. La nacelle accueille l’enfant vers son bord avant.

Les six variantes du toboggan sont mélangées avec une graine par personnage et par série : trois postures, avec ou sans saut de joie. Le choix reste stable pendant chaque passage. Les transitions d’installation et de redressement conservent le contact avec la glissière ; le saut survient après le retour au sol. Le déplacement de l’adulte est une séquence non répétée, qui termine par une surveillance sans limite de durée. Il regarde le siège mobile et garde ses distances avec sa trajectoire.

Les contacts restent fixes par rapport à la base du modèle sur le terrain incliné. La limite reste de douze personnages pour le secteur, avec un accompagnateur à la place d’un adulte statique. Masquer les jeux masque aussi leurs utilisateurs. Toutes ces actions sont des animations illustratives demandées par l’utilisateur, pas des observations de personnes réelles.

Les tests couvrent les sept emprises dans le polygone OSM **et** la surface de jeux officielle, tous les circuits d’enfants, les contacts sièges/enfants sur un cycle, et le raccord du sol au terrain. La version P0.6.6 conserve ses cinq anciens modèles ; les ajouts au moteur de personnages n’agissent que sur les nouveaux types d’interaction.
