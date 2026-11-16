"""Package explicitly authored visual estimates; never derive unseen façade rows."""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / 'crans-montana-p06/assets/streetview-survey/2026-11-15/survey-data.json'
TARGET = REPO / 'preview-ycoor-design/design/design-evidence.json'
raw = json.loads(SOURCE.read_bytes())
geometry = json.loads((REPO / 'preview-ycoor-design/assets/ycoor-dxf.json').read_bytes())
by_id = {building['id']: building for building in geometry['buildings']}


def match(building_id, visual_ids, status, evidence_ids, reason):
    building = by_id[building_id]
    return dict(buildingId=building_id, sourceUuid=building['sourceUuid'], sourceDate=building['sourceDate'],
                surveyIds=visual_ids, status=status, evidenceIds=evidence_ids, reason=reason)


matches = [
    match('1A20B', ['B002'], 'confirmed', ['C005', 'C007', 'C008'],
          'Partie centrale du groupe B002 : continuité des volumes le long de la route, succession des balcons et position entre les vues au nord et au sud. Correspondance visuelle multi-vues ; identité cadastrale non établie.'),
    match('2329F', ['B002'], 'confirmed', ['C008', 'C012', 'C051'],
          'Partie du groupe B002 proche du coude de la route : raccord au volume à bardage et alignement du front bâti dans les vues opposées. Un même repère visuel regroupe plusieurs volumes CAD.'),
    match('2355E', ['B002'], 'confirmed', ['C003', 'C026', 'C027'],
          'Extrémité sud du groupe B002 : face devant la caméra C003 et bord du passage séparant B002 de B003 dans C026/C027. La position des caméras, le passage et la silhouette du volume concordent.'),
    match('26152', ['B007'], 'unresolved', ['C041', 'C042'],
          'B007 est un candidat visuel pour ce volume allongé côté étang, mais la correspondance et son état actuel ne sont pas suffisamment établis. La source géométrique de juin 2020 le classe « Im Bau ». Aucune modification de volume n’est appliquée.'),
    match('2997D', ['B002'], 'confirmed', ['C010', 'C011', 'C012', 'C055', 'C053', 'C054'],
          'Partie du groupe B002 donnant sur Rawyl : le front oblique à bardage et commerce est recoupé par C010/C011/C012 et la vue routière C055. Les vues rapprochées C053/C054 confirment les matériaux de la devanture ; leurs coordonnées de contributeur ne servent pas à la placer.'),
    match('2F7D6', ['B003'], 'confirmed', ['C026', 'C029', 'C030'],
          'Volume séparé au sud du passage : balcon à garde-corps rouges et rez vitré visibles dans C029/C030, côté opposé à B002 dans C026. Correspondance de silhouette et de situation, sans identité cadastrale revendiquée.'),
]

FACE = '2997D:wall:002'
SOUTH_FACE = '2F7D6:wall:001'
observations = [
    dict(observationId='OBS-RAWYL-2024', buildingId='2997D', faceId=FACE, sourceId='streetview',
         captureIds=['C055', 'C010', 'C011', 'C012'], observedAt='2024-06', confidence='high',
         statement='La façade sur Rawyl présente une devanture vitrée, un bandeau/avant-toit en bois, une bande verticale de bardage horizontal et des balcons à garde-corps en bois. Trois baies superposées sont retenues dans la partie documentée ; aucune trame de fenêtres n’est extrapolée aux autres faces.',
         limitations=['Les interfaces Google, le cadrage et les véhicules masquent certaines zones.',
                      'Les dimensions, niveaux et profondeurs du modèle de détail sont des estimations visuelles.',
                      'La face géométrique entière mesure environ 26 m : le pilote détaille sa partie commerciale documentée, pas toutes ses travées.']),
    dict(observationId='OBS-SHOP-2025', buildingId='2997D', faceId=FACE, sourceId='streetview',
         captureIds=['C053', 'C054'], observedAt='2025-06', confidence='high',
         statement='Les vues rapprochées de juin 2025 montrent le vitrage de la boutique, l’entrée et l’encadrement clair, sous un avant-toit en bois. Elles confirment l’apparence de la partie basse, sans fournir de cotes mesurées.',
         limitations=['Panoramas de contributeur : coordonnées et orientation physique non calibrées.',
                      'Le mur de pierre opposé apparaît en reflet dans le vitrage ; il n’est pas reproduit comme un mur opaque de la boutique.',
                      'Les vélos et les reflets ne sont pas des éléments de construction et ne sont pas modélisés.']),
    dict(observationId='OBS-SOUTH-2024', buildingId='2F7D6', faceId=SOUTH_FACE, sourceId='streetview',
         captureIds=['C030', 'C029', 'C026'], observedAt='2024-06', confidence='high',
         statement='La partie nord de la façade ouest de B003 montre quatre baies vitrées complètes dans un encadrement bois, trois garde-corps de balcon superposés rouge brun, des dalles claires et des claustras verticaux. Le vitrage derrière le balcon inférieur est partiellement visible.',
         limitations=['Quatre baies sont retenues dans le cadrage, pas comme total du bâtiment ; une baie supplémentaire est coupée à droite.',
                      'Véhicule, interface Google et cadrage masquent des parties de la façade. Les reflets et plantes ne sont pas modélisés.',
                      'La protection rouge au bord du toit paraît temporaire et n’est pas ajoutée comme ornement permanent.',
                      'La face ouest est vue en biais : le cap central 90° de C029/C030 pointe vers le retour nord, pas vers cette face. Attribution visuelle de contexte, sans calage photographique métrique.',
                      'Positions, altitudes des détails, dimensions, couleurs, profondeur et nombre de barreaux/lames sont des choix artistiques approximatifs. Aucun ajout sur le retour nord, le retrait supérieur ou le reste des 31 m de façade.']),
    dict(observationId='OBS-NORTH-UNRESOLVED', buildingId='26152', faceId=None, sourceId='streetview',
         captureIds=['C041', 'C042'], observedAt='2024-06', confidence='low',
         statement='Les vues depuis le côté minigolf montrent des façades à balcons au-delà de l’étang. L’attribution précise au volume CAD 26152 reste à vérifier avant de corriger le statut de construction ou sa forme.',
         limitations=['Ces vues sont lointaines.', 'Aucune augmentation de hauteur ni suppression du statut source n’est déduite automatiquement.']),
]


def rect(id, kind, u, v, width, height, color, label, **extra):
    settings = dict(depth=.02, offset=.035)
    if kind == 'panel':
        settings = dict(depth=.01, offset=.004)
    elif kind == 'beam':
        settings = dict(depth=.04, offset=.025)
    settings.update(extra)
    return dict(id=id, kind=kind, u=u, v=v, width=width, height=height, color=color,
                label=label, **settings)


def balcony(id, v):
    # Each balcony is an explicitly placed feature. Bars are an illustrative
    # low-resolution representation, not an observed or surveyed bar count.
    rails = [
        dict(u=0, v=.44, width=4.7, height=.10, depth=.09, offset=.56, color='#8d6844'),
        dict(u=0, v=-.42, width=4.7, height=.09, depth=.09, offset=.56, color='#8d6844'),
        dict(u=-2.10, v=0, width=.09, height=.88, depth=.08, offset=.57, color='#a98152'),
        dict(u=-1.40, v=0, width=.09, height=.88, depth=.08, offset=.57, color='#a98152'),
        dict(u=-.70, v=0, width=.09, height=.88, depth=.08, offset=.57, color='#a98152'),
        dict(u=0, v=0, width=.09, height=.88, depth=.08, offset=.57, color='#a98152'),
        dict(u=.70, v=0, width=.09, height=.88, depth=.08, offset=.57, color='#a98152'),
        dict(u=1.40, v=0, width=.09, height=.88, depth=.08, offset=.57, color='#a98152'),
        dict(u=2.10, v=0, width=.09, height=.88, depth=.08, offset=.57, color='#a98152'),
    ]
    return dict(id=id, kind='balcony', u=-23.15, v=v, width=4.7, height=1.1,
                depth=.65, color='#a98152', rails=rails, floor=dict(height=.14, color='#ded6bf'),
                label='Balcon visible · placement/profondeur estimés, barreaux symboliques')


# Positions are hand-authored visual estimates, not a count/row generator.
details = [
    rect('shop-light-surround', 'panel', -20.25, 1505.4, 11.0, 3.10, '#ccc9b9', 'Fond et encadrement clairs · interprétation de la devanture'),
    rect('balcony-recess', 'panel', -23.15, 1512.0, 4.8, 9.6, '#d6ceb9', 'Fond clair de la travée à balcons'),
    rect('timber-cladding', 'panel', -17.65, 1512.0, 4.8, 9.6, '#a66e42', 'Bardage bois · couleur interprétée'),
    rect('shop-left-display', 'window', -24.4, 1505.35, 2.55, 2.60, '#3c5866', 'Vitrine gauche', frame=dict(width=.09, color='#d0d1c1')),
    rect('shop-entry', 'door', -21.75, 1505.35, 1.55, 2.60, '#2c4655', 'Entrée vitrée de la boutique'),
    rect('shop-right-display', 'window', -17.95, 1505.35, 5.80, 2.60, '#3c5866', 'Vitrine droite · travée visible', frame=dict(width=.09, color='#d0d1c1')),
    rect('entry-left-frame', 'trim', -22.56, 1505.35, .08, 2.70, '#d0d1c1', 'Montant clair de l’entrée'),
    rect('entry-right-frame', 'trim', -20.94, 1505.35, .08, 2.70, '#d0d1c1', 'Montant clair de l’entrée'),
    rect('wood-canopy-band', 'beam', -20.25, 1507.10, 11.0, .60, '#925e37', 'Bandeau de l’avant-toit en bois'),
    rect('dark-shop-sign', 'panel', -21.75, 1507.10, 2.45, .38, '#252d29', 'Enseigne sombre · lettrage non restitué', offset=.069, depth=.008),
    rect('timber-lower-bay', 'window', -17.65, 1509.10, 2.05, 1.30, '#3b505a', 'Baie inférieure dans le bardage', frame=dict(width=.10, color='#b99869')),
    rect('timber-middle-bay', 'window', -17.65, 1512.30, 2.05, 1.30, '#3b505a', 'Baie intermédiaire dans le bardage', frame=dict(width=.10, color='#b99869')),
    rect('timber-upper-bay', 'window', -17.65, 1515.50, 2.05, 1.30, '#3b505a', 'Baie supérieure retenue dans la zone visible', frame=dict(width=.10, color='#b99869')),
    rect('recess-lower-shadow', 'panel', -23.15, 1509.0, 2.65, 1.75, '#5a5749', 'Ouverture en retrait · interprétation de l’ombre visible', offset=.018),
    rect('recess-middle-shadow', 'panel', -23.15, 1512.2, 2.65, 1.75, '#5a5749', 'Ouverture en retrait · interprétation de l’ombre visible', offset=.018),
    rect('recess-upper-shadow', 'panel', -23.15, 1515.4, 2.65, 1.75, '#5a5749', 'Ouverture en retrait · interprétation de l’ombre visible', offset=.018),
    balcony('lower-balcony', 1508.20),
    balcony('middle-balcony', 1511.40),
    balcony('upper-balcony', 1514.60),
]
detail_sources = {
    'shop-light-surround': ['C055', 'C054'],
    'balcony-recess': ['C012', 'C055'],
    'timber-cladding': ['C012', 'C010', 'C055'],
    'shop-left-display': ['C055', 'C053'],
    'shop-entry': ['C054', 'C055'],
    'shop-right-display': ['C053', 'C054', 'C055'],
    'entry-left-frame': ['C054', 'C055'],
    'entry-right-frame': ['C054', 'C055'],
    'wood-canopy-band': ['C055', 'C053'],
    'dark-shop-sign': ['C055', 'C012'],
    'timber-lower-bay': ['C012', 'C055'],
    'timber-middle-bay': ['C012', 'C010'],
    'timber-upper-bay': ['C012', 'C010'],
    'recess-lower-shadow': ['C055', 'C012'],
    'recess-middle-shadow': ['C012', 'C011'],
    'recess-upper-shadow': ['C012', 'C011'],
    'lower-balcony': ['C055', 'C012'],
    'middle-balcony': ['C012', 'C011'],
    'upper-balcony': ['C012', 'C011'],
}
for detail in details:
    detail['evidenceIds'] = detail_sources[detail['id']]


def south_balcony(id, v):
    # Reuse the explicit rail/floor primitive. Rail count is symbolic; these
    # three separate calls below do not infer a building-wide floor pattern.
    return dict(id=id, kind='balcony', u=4.05, v=v, width=7.8, height=1.05,
                depth=.80, color='#8e4135', floor=dict(height=.14, color='#e5dfca'),
                rails=[
                    dict(u=0, v=.44, width=7.8, height=.075, depth=.07, offset=.71, color='#8e4135'),
                    dict(u=0, v=.15, width=7.8, height=.065, depth=.07, offset=.71, color='#8e4135'),
                    dict(u=0, v=-.14, width=7.8, height=.065, depth=.07, offset=.71, color='#8e4135'),
                    dict(u=0, v=-.43, width=7.8, height=.065, depth=.07, offset=.71, color='#8e4135'),
                    dict(u=-3.70, v=0, width=.065, height=.98, depth=.07, offset=.71, color='#794137'),
                    dict(u=-1.25, v=0, width=.065, height=.98, depth=.07, offset=.71, color='#794137'),
                    dict(u=1.25, v=0, width=.065, height=.98, depth=.07, offset=.71, color='#794137'),
                    dict(u=3.70, v=0, width=.065, height=.98, depth=.07, offset=.71, color='#794137'),
                ], evidenceIds=['C030', 'C029'],
                label='Balcon visible · dalle claire, garde-corps rouge brun, barreaux symboliques')


def south_screen(id, u, v):
    # The existing balcony primitive also carries explicit rail-only screens.
    # No floor is added to a screen; five lames are an illustrative density.
    return dict(id=id, kind='balcony', u=u, v=v, width=.75, height=2.1, depth=.72,
                color='#5e3933', label='Claustra vertical visible · lames et profondeur interprétées',
                rails=[
                    dict(u=-.32, v=0, width=.055, height=2.1, depth=.55, offset=.13, color='#5e3933'),
                    dict(u=-.16, v=0, width=.055, height=2.1, depth=.55, offset=.13, color='#5e3933'),
                    dict(u=0, v=0, width=.055, height=2.1, depth=.55, offset=.13, color='#5e3933'),
                    dict(u=.16, v=0, width=.055, height=2.1, depth=.55, offset=.13, color='#5e3933'),
                    dict(u=.32, v=0, width=.055, height=2.1, depth=.55, offset=.13, color='#5e3933'),
                ], evidenceIds=['C030', 'C029'])


south_details = [
    rect('south-timber-surround', 'panel', 4.1, 1500.85, 7.5, 2.75, '#9b633e', 'Encadrement bois du rez vitré · teinte et motifs simplifiés'),
    rect('south-ground-glass-1', 'window', 1.35, 1500.75, 1.5, 2.3, '#526971', 'Première baie complète visible', frame=dict(width=.11, color='#a46d44')),
    rect('south-ground-glass-2', 'window', 3.15, 1500.75, 1.5, 2.3, '#526971', 'Deuxième baie complète visible', frame=dict(width=.11, color='#a46d44')),
    rect('south-ground-glass-3', 'window', 4.95, 1500.75, 1.5, 2.3, '#526971', 'Troisième baie complète visible', frame=dict(width=.11, color='#a46d44')),
    rect('south-ground-glass-4', 'window', 6.75, 1500.75, 1.5, 2.3, '#526971', 'Quatrième baie complète visible · suite coupée dans la photo', frame=dict(width=.11, color='#a46d44')),
    rect('south-timber-lintel', 'beam', 4.1, 1502.12, 7.5, .55, '#8a5739', 'Bandeau bois au-dessus des vitrages'),
    rect('south-lower-recess-glass-a', 'window', 2.8, 1503.65, 2.1, 2.1, '#435967', 'Vitrage visible derrière le balcon inférieur · partie gauche', frame=dict(width=.10, color='#93613f')),
    rect('south-lower-recess-glass-b', 'window', 5.0, 1503.65, 2.1, 2.1, '#435967', 'Vitrage visible derrière le balcon inférieur · partie droite', frame=dict(width=.10, color='#93613f')),
    south_balcony('south-balcony-lower', 1502.95),
    south_balcony('south-balcony-middle', 1505.75),
    south_balcony('south-balcony-upper', 1508.55),
    south_screen('south-screen-lower-north', .62, 1503.80),
    south_screen('south-screen-lower-division', 7.30, 1503.80),
    south_screen('south-screen-middle-division', 7.30, 1506.60),
    south_screen('south-screen-upper-division', 7.30, 1509.40),
]
for detail in south_details:
    detail.setdefault('evidenceIds', ['C029', 'C030'])

changes = [
    dict(changeId='RAWYL-FACADE-PILOT', buildingId='2997D', faceId=FACE, status='ready',
         title='Façade Rawyl · devanture et étages visibles', discrepancy='missing_detail',
         evidenceIds=['C055', 'C010', 'C011', 'C012', 'C053', 'C054'], observationIds=['OBS-RAWYL-2024', 'OBS-SHOP-2025'],
         reason='Les volumes officiels ne décrivent pas cette apparence de façade. Le pilote ajoute une interprétation pixel-art de la partie documentée, sans modifier les sommets du bâtiment ni prétendre à un relevé métrique.',
         confidence='medium', approximate=True, focus=dict(u=-20.5, height=1510.5), details=details),
    dict(changeId='SOUTH-RED-BALCONIES', buildingId='2F7D6', faceId=SOUTH_FACE, status='ready',
         title='B003 · garde-corps rouges et rez vitré', discrepancy='missing_detail',
         evidenceIds=['C030', 'C029', 'C026'], observationIds=['OBS-SOUTH-2024'],
         reason='Les vues C029/C030 documentent la partie nord du front ouest, recoupée par le contexte de C026. Quatre baies, le bois et trois balcons sont interprétés avec les mêmes éléments que le premier pilote ; aucune répétition sur le reste du bâtiment. Le cap central ne constitue pas un calage métrique de cette face oblique.',
         confidence='medium', approximate=True, focus=dict(u=4.1, height=1505.0), details=south_details),
    dict(changeId='NORTH-CONSTRUCTION-STATUS', buildingId='26152', faceId=None, status='unresolved',
         title='Volume nord · statut « en construction »', discrepancy='unresolved',
         evidenceIds=['C041', 'C042'], observationIds=['OBS-NORTH-UNRESOLVED'],
         reason='Le statut provient de données sources de juin 2020. Les vues de 2024 ne suffisent pas encore à valider la correspondance et une modification précise du volume.',
         confidence='low', approximate=True, details=[]),
    dict(changeId='WEST-SHUTTERS', buildingId='2355E', faceId=None, status='unresolved',
         title='B002 · volets rouges et entrée côté accès', discrepancy='missing_detail',
         evidenceIds=['C003', 'C026', 'C027'], observationIds=[],
         reason='Les volets et l’entrée sont visibles, mais cette autre face ne reçoit pas encore de détails. Les zones cachées par l’interface et les véhicules restent à vérifier.',
         confidence='medium', approximate=True, details=[]),
]

capture_ids = {capture_id for match in matches for capture_id in match['evidenceIds']}
capture_ids |= {capture_id for observation in observations for capture_id in observation['captureIds']}
data = dict(schemaVersion=1, authoredAt='2026-11-16',
            policy='Source geometry unchanged. Visual IDs are not cadastral IDs. Documented visible façade zones only; positions, dimensions, colours, depths and rail/screen density are artistic estimates. No hidden-face extrapolation.',
            buildingMatches=matches, observations=observations, changes=changes,
            captures=[capture for capture in raw['captures'] if capture['capture_id'] in capture_ids])
TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Authored {len(matches)} matches, {len(observations)} observations, {sum(len(change["details"]) for change in changes)} explicit details; original captures preserved.')
