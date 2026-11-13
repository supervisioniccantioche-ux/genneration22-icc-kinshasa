# Rapport de livraison — Sprint C01

**Intitulé :** modèle de données minimum et référentiel de démonstration

**Périmètre :** données fictives en mémoire, sans base de données, sans authentification et sans persistance après rechargement.

**Règle stratégique :** référence J0 = 1 000 membres intégrés et 50 leaders actifs; cible J90 = 3 000 membres intégrés et 300 leaders actifs.

## 1. Résultat

Les modules de la maquette lisent désormais un référentiel de démonstration partagé plutôt que des listes et chiffres indépendants dans chaque vue. Les indicateurs de l’échantillon sont calculés à partir des personnes, leaders, relations, actions et alertes. La référence stratégique J0 et les jalons J0/J30/J60/J90 sont conservés séparément : les données fictives du petit jeu de démonstration ne sont pas présentées comme les résultats du projet.

Le périmètre visuel et les écrans existants sont conservés. Les mutations prévues en C01 sont locales à la session : ajouter une personne et terminer/réouvrir une action. Elles ne créent pas de données persistantes.

## 2. Modèle centralisé

Le référentiel se trouve dans `lib/demo/` :

- `types.ts` — types et contrats des entités;
- `seed.ts` — jeu de démonstration et date de référence;
- `selectors.ts` — calcul des vues, indicateurs, échéances, générations et décisions;
- `validation.ts` — contrôles d’intégrité du jeu;
- `store.ts` — mutations locales déterministes;
- `selectors.test.mts` — tests des règles et sélecteurs.

Entités du jeu :

| Entité | Données principales et liens |
|---|---|
| Personne | Identifiant stable, nom, coordonnées facultatives, état d’intégration, étape de développement, responsable et rattachement à une communauté. |
| Structure | Hiérarchie zone → pôle → communauté, portée par `parentId`. |
| Leader | Personne validée, date de validation, activité, responsabilité et coach; les sources opérationnelles sont marquées G1. |
| Relation de développement | Leader accompagnateur, personne potentielle, dates et état actif/suspendu/terminé. |
| Action | Personne concernée, responsable, type, échéance ISO, état et date de réalisation. |
| Alerte | Sévérité, statut et lien vers une personne, un leader, une action ou une décision existante. |
| Décision de gouvernance | Structure, responsable personne, échéance, état et progression. |
| Référence stratégique | Valeurs J0, cible J90 et jalons J30/J60, séparés des données fictives. |

## 3. Règles de calcul

- **Génération :** une source opérationnelle explicitement marquée G1 est la racine. G2, G3 et G4 sont calculées en suivant les relations actives vers une personne qui possède une fiche Leader validée. Une personne potentielle sans fiche Leader n’est donc pas comptée comme leader et n’ouvre pas une nouvelle génération.
- **Potentiels identifiés :** nombre de personnes distinctes liées par une relation active ou suspendue; les relations terminées restent visibles comme historique mais ne gonflent pas le vivier courant.
- **Potentiels actifs :** personnes distinctes ciblées par une relation active.
- **Multiplicateur :** leader actif avec exactement trois potentiels actifs. Le validateur interdit d’en attacher plus de trois.
- **Leaders actifs / validés :** issus des fiches Leader; un profil de personne seul ne suffit pas.
- **Actions en retard :** actions ouvertes dont l’échéance ISO est antérieure à la date de référence. Aujourd’hui et Cette semaine sont calculés à partir de cette même date.
- **Alertes :** les compteurs du tableau de bord, du panneau d’alertes et des notifications sont calculés depuis les mêmes alertes ouvertes.
- **Décisions :** les lignes, responsables, structures, statuts et échéances proviennent du même jeu de données.
- **J0 et J90 :** restent des valeurs stratégiques déclarées; elles ne sont jamais recalculées depuis l’échantillon.

## 4. Date de référence et intégrité

La démonstration utilise le **vendredi 13 novembre 2026** comme date de référence explicite. Les échéances sont enregistrées au format `AAAA-MM-JJ`, puis affichées relativement ou avec leur vrai jour de semaine (par exemple demain ou sam. 14 nov.). Les dates impossibles ou non conformes à ISO sont signalées.

Le validateur vérifie notamment :

- unicité des identifiants entre les entités;
- présence des références personne, leader, responsable, action, décision et structure;
- hiérarchie zone → pôle → communauté et cohérence du rattachement des personnes;
- absence d’auto-responsabilité, d’auto-accompagnement et de cycles de développement;
- absence de doublon de relation active, de plusieurs coaches actifs non arbitrés et de plus de trois potentiels actifs;
- rattachement G1 explicite des leaders sources et calcul possible jusqu’à G4;
- date de réalisation sur une action terminée, dates ISO valides et progression de décision comprise entre 0 et 100.

Un badge dans l’application signale l’état de cohérence du jeu de démonstration.

## 5. Vues alimentées par le référentiel

| Vue | Données désormais partagées/calculées |
|---|---|
| Tableau de bord | Taille de l’échantillon, personnes accompagnées, leaders actifs, potentiels, actions en retard, pipeline, générations et alertes. Les bases J0 et cibles sont nommées comme telles. |
| Personnes | Référentiel de personnes, recherche, filtres et informations dérivées (responsable, génération, prochaine action, communauté). |
| Leadership | Comptages par étape calculés depuis les statuts du modèle. |
| Générations | Leaders et liens réels du jeu; génération dérivée, parent et nombre de potentiels actifs. |
| Actions | Actions liées à des personnes et responsables; filtres Aujourd’hui, Cette semaine, En retard et Terminées; bascule ouverte/terminée en mémoire. |
| Alertes | Alerte et entité liée, sévérité, responsable, échéance et compteurs issus de la même collection. |
| Rapports | Instantané calculé de l’échantillon et références J0/J90 séparées. La courbe existante est explicitement étiquetée comme illustration, pas comme historique réel. |
| Gouvernance | Décisions seedées, responsables, structures, états, progressions et échéances calculés. |

## 6. Vérifications à exécuter avant fusion

Validations exécutées :

- `pnpm run test:demo` — 10 tests réussis, 0 échec. Node 24 émet un avertissement non bloquant `MODULE_TYPELESS_PACKAGE_JSON` lors du chargement des sources `.ts` par le runner natif; cela n’affecte ni le résultat ni le runtime Next.js.
- `pnpm exec tsc --noEmit` — réussi.
- `pnpm run build` — réussi; route `/` générée statiquement.
- Navigateur à 1120 × 718 — tableau de bord, rapports, alertes, gouvernance, génération calculée et relations actives/suspendues vérifiés. Le parcours d’ajout et de clôture d’action a été exercé; un rechargement réinitialise le jeu à 15 personnes et 4 actions, conformément au périmètre sans persistance.

## 7. Hors périmètre C01 / suites proposées

Ces éléments sont volontairement laissés aux sprints suivants, et ne doivent pas être interprétés comme des workflows déjà fonctionnels :

1. persistance serveur, migrations et synchronisation multi-utilisateur;
2. authentification réelle, rôles et permissions;
3. création/modification/validation d’une relation et promotion d’un potentiel en leader;
4. édition, archivage et dédoublonnage des personnes;
5. création/réaffectation d’actions, commentaire et historique;
6. acquittement/résolution d’alertes et journal d’audit;
7. création et validation de décisions de gouvernance;
8. séries temporelles réelles, exports et calculs de rapports de production;
9. règles définitives sur les coaches multiples, les dates métier et le rôle du Patriarche dans les chaînes opérationnelles.

Ces choix demandent une validation métier avant d’être transformés en workflows persistants.
