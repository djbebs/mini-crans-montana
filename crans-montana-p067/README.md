# Mini Crans-Montana · P0.6.7

[Ouvrir P0.6.7](https://djbebs.github.io/mini-crans-montana/crans-montana-p067/) · [Accueil](https://djbebs.github.io/mini-crans-montana/) · [Version précédente P0.6.6](https://djbebs.github.io/mini-crans-montana/crans-montana-p06/)

Cette version ouvre directement la maquette interactive d’Ycoor : volumes DXF locaux, trois parties de façades documentées, sources, relevé Street View, personnages et jeux. Son adresse reste `/crans-montana-p067/`. L’accueil la présente comme dernière version ; les versions précédentes et les ateliers conservent leurs adresses.

Le fichier `index.html` est produit depuis `preview-ycoor-design/index.html` avec `python tools/build-p067.py`. Le générateur adapte l’identité visible et les chemins des fichiers partagés. Le moteur P0.6.6, les modules de conception et les données sont réutilisés à leur emplacement d’origine. Il n’y a ni redirection ni page intégrée.

Pour les prochaines faces, modifier le fichier du bâtiment dans `preview-ycoor-design/design/facades/`, puis lancer `python tools/update-ycoor.py`. Cette commande reconstruit les preuves, vérifie les détails contre les faces, exporte l’inventaire et régénère cette version. `--check` contrôle toutes les sorties sans écrire. Les [sources et limites](../preview-ycoor-design/README.md) et le [guide du secteur](../docs/design/facade-workflow.md) décrivent le cycle court.

L’inventaire porte sur six volumes et 43 plans de murs sources : trois partiellement dessinés, 36 à examiner et quatre en attente de vérification du volume B007. Il ne dénombre pas toutes les fenêtres physiques ; aucun plan n’est déclaré terminé. Les exports [JSON](../preview-ycoor-design/design/facade-inventory.json) et [CSV](../preview-ycoor-design/design/facade-inventory.csv) conservent ces inconnues explicitement.
