# Compléter le petit secteur Ycoor

La P0.6.7 dispose d’un inventaire des **six volumes et 43 plans de murs sources**. B002 regroupe plusieurs volumes CAD : ce n’est ni un décompte de bâtiments cadastraux, ni une promesse de 43 façades physiques indépendantes. Les trois faces déjà traitées restent partielles. Le total de fenêtres et le nombre restant ne sont pas établis.

## Un cycle par face

1. Dans **Inventaire des bâtiments**, choisir un volume puis **Voir cette face**. Vérifier les photographies candidates et attribuer des preuves à cette face ; une photo candidate pour le bâtiment n’est pas une preuve de toutes ses faces.
2. Modifier uniquement `preview-ycoor-design/design/facades/<buildingId>.json`. Ajouter une observation et un changement explicite, avec un `faceId` existant, les captures originales et des détails placés individuellement. Réutiliser les fenêtres, volets, portes, bardages, cadres et garde-corps déjà disponibles. Les pièces d’un même vitrage ne prouvent pas plusieurs fenêtres physiques.
3. Exécuter `python tools/update-ycoor.py`, examiner la face dans la P0.6.7 et corriger. Le constructeur rassemble les métadonnées originales, vérifie les références et les unions de triangles, régénère les exports et la page de version. `python tools/update-ycoor.py --check` vérifie tout sans écrire.

L’ordre des bâtiments, observations et changements se règle dans `design/facades/index.json` ; ajouter les nouveaux identifiants à ces listes. La dernière proposition prête est cadrée au lancement. Les fichiers de preuves, inventaire et page P0.6.7 sont générés : leur source d’édition est le fichier du bâtiment ou l’HTML de travail, pas la sortie générée.

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
