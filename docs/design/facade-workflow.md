# Compléter le petit secteur Ycoor

La P0.6.7 dispose d’un inventaire des **six volumes et 43 plans de murs sources**. B002 regroupe plusieurs volumes CAD : ce n’est ni un décompte de bâtiments cadastraux, ni une promesse de 43 façades physiques indépendantes. Au 23 novembre 2026, **269 composants sont dessinés sur quatorze plans partiels**, dont les quatre côtés de B003 ([état détaillé](b003-facades.md)). Le total de fenêtres et le nombre restant ne sont pas établis.

Le lot du 23 novembre ajoute 101 composants : front Rawyl, deux faces du volume d’angle 2329F, face ouest centrale 1A20B et extrémité 2355E à l’ouest et au sud. Cinq nouvelles captures intégrales conservent URL, coordonnées/cap du visualiseur et date affichée (quatre vues de juin 2024, une sphère de juin 2022). Les 30 plans sans détails ont un motif d’attente ; les quatre plans de 26152 restent bloqués par la vérification du volume. Les côtés cachés, petits retraits hauts et contacts entre volumes ne reçoivent pas de fenêtres extrapolées.

Les [15 captures complémentaires indexées](../../crans-montana-p06/assets/streetview-survey/2026-11-15/supplement-index.csv) et leur [schéma de positions de caméra](../../crans-montana-p06/assets/streetview-survey/2026-11-15/supplement-map.svg) complètent le relevé original sans le réécrire. Ce schéma ne représente ni les surfaces effectivement recensées ni une garantie de couverture exhaustive. Le GPS physique et le cap par rapport au nord vrai restent non calibrés.

Un second lot du même jour porte ces compléments à **18 captures**. Il ajoute une [reconstitution photographique de B007](b007-reconstruction.md), avec 71 composants et des hauteurs explicitement estimées. Elle se charge séparément ; le volume source et ses quatre plans bloqués restent disponibles sans modification. Elle n’est pas comprise dans les quatorze plans partiels ni dans les 269 composants du registre officiel.

Le lot [côté jeux](playground-facades.md) ajoute ensuite 49 composants sur cinq plans auparavant vides : les deux fronts est de B002, les deux pans est de B003 et le front sud-est du Rawyl. Les compléments photographiques passent à 21 captures. Les ouvertures encore cachées restent inconnues.

## Un cycle par lot

Préparer le contexte avec `node tools/prepare-facade-batch.mjs`. Il contient au plus cinq volumes admissibles, deux faces par volume et trois photos candidates. `--building 2355E --building 2F7D6` cible B002 et B003 ; `--faces`, `--photos` et `--limit` règlent la taille. `--output CHEMIN` enregistre le dossier au lieu de l’imprimer.

Ce dossier court donne les fichiers à éditer, les plans sources et leurs triangles, les détails existants, les photos à examiner et les prochaines actions. Il liste aussi les faces et captures non incluses : la sélection ne signifie pas que le reste est terminé. Les volumes à vérifier sont exclus automatiquement ; une sélection explicite permet de les examiner en conservant le signalement du blocage.

1. Dans **Inventaire des bâtiments**, choisir un volume puis **Voir cette face**. Vérifier les photographies candidates et attribuer des preuves à cette face ; une photo candidate pour le bâtiment n’est pas une preuve de toutes ses faces.
2. Modifier les fichiers `preview-ycoor-design/design/facades/<buildingId>.json` du lot. Ajouter une observation et un changement explicite, avec un `faceId` existant, les captures originales et des détails placés individuellement. Réutiliser les fenêtres, volets, portes, bardages, cadres et garde-corps déjà disponibles. Les pièces d’un même vitrage ne prouvent pas plusieurs fenêtres physiques.
3. Exécuter une fois `python tools/update-ycoor.py`, examiner les faces modifiées dans la P0.6.7 et corriger si nécessaire. Le constructeur rassemble les métadonnées originales, vérifie les références et les unions de triangles, régénère les exports et la page de version. Regrouper le compte rendu et la publication par lot. `python tools/update-ycoor.py --check` vérifie tout sans écrire.

Les styles répétés sont dans `preview-ycoor-design/design/detail-templates.json`. Un détail peut référencer un `template` et garde obligatoirement ses propres `id`, `u`, `v`, `label` et `evidenceIds`. Les modèles ne portent ni position, ni identité, ni preuve. Les valeurs propres au détail remplacent celles du modèle ; un objet `frame`, `floor` ou un tableau `rails` est remplacé entièrement. Aucun modèle ne crée automatiquement une rangée de fenêtres.

Lire uniquement le dossier du lot et ses preuves réduit le contexte envoyé au modèle. Les vérifications automatiques restent groupées ; une modification du moteur demande ses tests, alors qu’un ajout de données réutilise les contrôles existants. Une refactorisation donnant des sorties identiques ne demande pas de refaire la revue visuelle. Les économies de texte se mesurent ; elles ne garantissent pas un pourcentage identique de tokens facturés.

L’ordre des bâtiments, observations et changements se règle dans `design/facades/index.json` ; ajouter les nouveaux identifiants à ces listes. Le lancement cadre tout le carré ; le sélecteur permet d’examiner une façade. Les fichiers de preuves, inventaire et page P0.6.7 sont générés : leur source d’édition est le fichier du bâtiment ou l’HTML de travail, pas la sortie générée. La même commande régénère désormais aussi le CSV, le schéma et les sommes de contrôle des captures complémentaires.

Prérequis : Python, Node.js et `npm ci` dans `preview-ycoor-design/design/`. Aucun service payant ni nouvelle dépendance n’est ajouté. Le paramètre `--node CHEMIN` permet de choisir l’exécutable Node. Les tests concernés se lancent avec `npm test` dans ce dossier et `python tools/test_build_design_evidence.py` pour les sources par bâtiment.

## Comment lire l’avancement

- **Partiellement dessinée** : au moins une zone visible a des détails, avec ses preuves. La face entière reste à examiner.
- **À examiner** : aucune zone documentée n’est encore dessinée ; cela ne veut pas dire qu’aucune fenêtre n’existe.
- **Correspondance à vérifier** : l’attribution visuelle du volume n’est pas encore suffisamment étayée.
- **Volume final à vérifier avant ajout** : l’identité visuelle est étayée mais le volume source demande une comparaison datée et mesurée. C’est le cas de 26152/B007.
- **Géométrie à vérifier** : le plan source ne peut pas recevoir de détails de manière fiable sans examen.

L’export JSON/CSV contient chaque plan de mur une fois, ses preuves appliquées, ses photos candidates, les composants dessinés et l’action suivante. Les cellules de total de fenêtres restent vides/nulles, avec `complete=false`. Il ne faut pas les interpréter comme zéro. Aucune face n’est déclarée terminée à ce stade.

## Ordre de travail conseillé

Continuer d’abord les parties directement visibles de B002 et B003, puis les autres faces identifiées avec des photographies exploitables. Pour chaque fenêtre, associer ses composants et ses preuves avant de prétendre à un décompte exhaustif. Les côtés cachés demandent de nouvelles prises de vue ; les dimensions exactes demandent des mesures.

Pour **26152/B007**, la vérification distingue les façades achevées en apparence en juin 2024 et l’attribut `Im Bau` de la source de juin 2020, toujours diffusée dans le flux courant. Le booléen `geometryReviewRequired` bloque de nouveaux ajouts prêts sur ce volume jusqu’à résolution de la vérification ; le retirer demande les preuves datées et mesurées décrites dans [26152-verification.md](26152-verification.md). L’état en novembre 2026 n’est pas déduit de la date de sauvegarde des captures.

Une future validation exhaustive devra établir, face par face, que les parties cachées ont été examinées et que toutes les ouvertures observées sont inventoriées. Les surfaces source, dates originales et captures intégrales restent conservées pendant ce travail.

## Passer à tout le village

Étendre le travail par secteurs : importer les volumes officiels, associer les vues utilisables, puis détailler les faces confirmées par lots. Conserver l’UUID et la tuile source lors des prochains imports pour éviter les collisions d’identifiants DXF. Les secteurs sans photos suffisantes restent signalés comme incomplets.

À cette échelle, le moteur devra charger les secteurs et les détails selon la vue et la distance, tout en conservant les volumes officiels pour la vue d’ensemble. Ce chargement progressif reste à implémenter ; le présent changement simplifie la préparation et l’édition, sans prétendre que tout le village est déjà importé.
