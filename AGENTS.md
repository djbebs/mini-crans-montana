# Travail efficace sur l’Atlas

Communiquer en français, brièvement. Le but est de représenter tout le village avec des preuves vérifiables, en limitant le travail répété.

## Ajouts de façades par lots

- Commencer par `node tools/prepare-facade-batch.mjs` : au plus cinq volumes admissibles, deux faces par volume et trois photos candidates. `--building ID` cible un volume. Les éléments non inclus restent listés.
- Lire seulement les sources des bâtiments sélectionnés, les modèles utilisés et les photos nécessaires. Élargir aux autres fichiers uniquement si une incertitude ou un changement de moteur le demande.
- Réutiliser `preview-ycoor-design/design/detail-templates.json` pour les paramètres visuels. Chaque détail garde ses propres identifiant, position, libellé et preuves. Aucune grille ou fenêtre cachée n’est déduite d’un modèle.
- Les captures, dates, coordonnées et URL originales restent intactes. Les identifiants visuels ne sont pas des identités cadastrales. Les fenêtres non recensées restent inconnues.
- Un volume bloqué, notamment 26152/B007, reste à vérifier avant tout nouvel ajout prêt. Une sélection explicite permet son examen, pas de contourner ce blocage.
- Faire un seul cycle de génération, contrôle visuel et publication par lot, avec corrections si nécessaire. Ne pas relancer une exploration complète, plusieurs revues ou un navigateur pour chaque détail.
- `python tools/update-ycoor.py` régénère et valide les exports. `--check` contrôle sans écrire. Les sorties générées ne sont pas des sources d’édition.
- Pour des ajouts de données, utiliser les contrôles existants et examiner les faces modifiées. Ajouter des tests si le comportement du constructeur, du validateur ou du moteur change. Sortie de tests concise ; détailler les échecs seulement.
- Une refactorisation des seules sources dont les sorties exécutées restent identiques peut être vérifiée par comparaison de ces sorties, sans refaire une session navigateur.
- Regrouper les tâches indépendantes seulement si cela apporte un gain ; éviter de multiplier les agents et les relectures sur une même petite face.
- Préserver les modifications existantes, les captures et les anciennes versions. Publication normale uniquement dans le périmètre déjà autorisé par l’utilisateur.

## Extension au village

Avancer par secteurs : volumes officiels d’abord, détails visibles confirmés ensuite. Réutiliser les composants sans extrapoler les ouvertures. Pour de nouveaux secteurs, conserver l’UUID source et la tuile d’origine : un identifiant local DXF seul ne suffit pas à l’échelle du village. Le chargement des secteurs et des détails selon la vue est une prochaine évolution du moteur, pas une capacité déjà acquise.

Procédure et limites : [docs/design/facade-workflow.md](docs/design/facade-workflow.md).
