# PRD – Urban Change Map

**Produit cartographique pour visualiser, comprendre et anticiper les travaux et transformations urbaines à NYC**

---

## 1. Vision produit

Créer une carte interactive qui permet à n'importe qui de comprendre **comment un quartier change dans le temps**.

Le produit ne montre pas des permis bruts.
Il montre des **lieux**, leur **niveau de transformation**, leur **maturité**, et leur **trajectoire temporelle**.

Objectif central:

> Rendre visibles, lisibles et comparables les transformations urbaines passées, en cours et à venir.

---

## 2. Problèmes utilisateurs

Aujourd'hui:

* Les données existent mais sont fragmentées (DOB, Planning, PDFs, cartes séparées).
* Impossible de répondre simplement à:

  * "Qu'est-ce qui se passe près de chez moi ?"
  * "Est-ce que ce quartier va beaucoup changer ?"
  * "Quand ?"
* Trop de bruit administratif (scaffold, renewals, permits techniques).
* Les documents clés (CEQR, ULURP) sont longs et illisibles pour un non-expert.

---

## 3. Utilisateurs cibles

### Utilisateur principal

* Habitants urbains curieux
* Acheteurs / locataires
* Journalistes locaux
* Urbanistes amateurs

### Utilisateurs secondaires

* Promoteurs
* Investisseurs locaux
* Associations de quartier
* Cabinets d'architecture

---

## 4. Proposition de valeur

Le produit permet de:

* Voir **où ça bouge**
* Comprendre **quoi exactement**
* Situer **quand ça arrive**
* Comparer **avant / maintenant / futur**
* Explorer **par quartier**, pas par permis

---

## 5. Concepts clés du modèle

### 5.1 Place

Un lieu géographique stable dans le temps.

Types:

* Point (adresse / BIN)
* Polygone (rezoning, parc, projet public)

Champs:

* place_id
* geometry
* neighborhood / NTA / Community District
* radius_of_influence

---

### 5.2 Project

Regroupement logique de dossiers administratifs qui décrivent une même transformation.

Un Project peut agréger:

* plusieurs permis DOB
* un dossier ZAP
* des documents CEQR
* des projets de capital public

Champs:

* project_id
* place_id
* project_type (private / public / rezoning)
* confidence_level (low / medium / high)

---

### 5.3 Event

Un événement daté dans la vie d'un projet.

Exemples:

* permit filed
* permit issued
* demolition
* renewal
* ULURP approved
* construction started
* expected completion

Champs:

* event_id
* project_id
* date or date_range
* source
* importance

Les Events alimentent les timelines.

---

## 6. Sources de données

### 6.1 Travaux et permis

* DOB NOW (permits actifs, statut actuel)
* DOB Permit Issuance (historique)

### 6.2 Planification et futur

* ZAP (ULURP, rezonings, special permits)
* CEQR filings (PDFs)

### 6.3 Projets publics

* Capital Projects Database (polygones)

### 6.4 Géographie et contexte

* PAD (adresse ↔ BBL ↔ géométrie)
* PLUTO / MapPLUTO
* Community Districts
* NTAs
* LION / Digital City Map

---

## 7. Pipeline de données

### 7.1 Ingestion

* Pull quotidien via APIs Open Data
* Ingestion PDFs (CEQR, ULURP)
* Stockage brut + versionné

### 7.2 Normalisation

Tous les enregistrements deviennent des Events normalisés.

### 7.3 Regroupement

* Regroupement par BIN + proximité temporelle
* Clustering des permits techniques
* Fusion ZAP + DOB quand géométrie overlap

### 7.4 Enrichissement

* Ajout zoning (PLUTO)
* Quartier officiel
* Typologie bâtiment
* Distance aux transports

---

## 8. Scoring et maturité

### 8.1 Score de transformation (0–100)

| Signal                | Points |
| --------------------- | ------ |
| EW / scaffold         | +5     |
| Plumbing / mechanical | +10    |
| A2 répétés            | +15    |
| Demolition            | +25    |
| A1 / New Building     | +40    |
| ZAP filed             | +10    |
| ZAP approved          | +25    |
| Capital project       | +30    |

Score cappé à 100.

---

### 8.2 Niveaux de maturité

* 0–20: stable
* 20–50: frictions locales
* 50–80: transformation active
* 80–100: mutation lourde

---

## 9. Dimension temporelle

Le temps est un axe de navigation principal.

Fonctionnalités:

* Slider global (2000 → 2035)
* Modes:

  * passé
  * présent
  * futur proche (1–3 ans)
  * futur lointain (3–10 ans)

Chaque Event est positionné sur la timeline.

---

## 10. Carte et visualisation

### 10.1 Vue par défaut

* Carte NYC
* Heatmap de transformation
* Points et polygones superposés

### 10.2 Encodage visuel

* Taille: intensité
* Couleur: maturité
* Opacité: certitude
* Polygones: projets structurants

---

## 11. Interaction utilisateur

### 11.1 Click sur une zone

Affiche un panneau latéral:

**Header**

* Nom du lieu
* Quartier
* Statut global

**Résumé humain**
Texte synthétique généré:

> "Zone en transformation progressive.
> Activité continue depuis 2021.
> Plusieurs permis techniques et un projet public à proximité."

**Timeline**
Liste verticale d'Events cliquables.

**Documents**

* Résumés CEQR / ULURP
* Lien vers PDFs officiels

---

## 12. Résumé automatique des PDFs

### Pipeline

* Extraction texte
* Résumé structuré:

  * objectif
  * périmètre
  * impacts
  * timeline
* Génération de milestones

### UI

* 5 bullets max
* Timeline simplifiée
* Lien source

---

## 13. Filtres et exploration

Filtres:

* période
* type de projet
* intensité
* public vs privé

Recherche:

* adresse
* quartier
* rayon géographique

---

## 14. Notifications (phase 2)

Possibilités:

* suivre une zone
* alerte quand score dépasse un seuil
* alerte nouveaux projets futurs

---

## 15. Indicateurs de succès

* Temps moyen passé sur la carte
* Nombre de zones explorées par session
* Usage du slider temporel
* Taux de clic sur timelines
* Retours qualitatifs ("j'ai compris mon quartier")

---

## 16. Ce que le produit **n'est pas**

* Un outil légal
* Une promesse de certitude
* Un substitut aux sources officielles

Le produit montre **l'état observable et interprété** de la ville.

---

## 17. Phasage recommandé

### Phase 1

* Greenpoint / Brooklyn
* Carte + heatmap
* Permits + ZAP
* Timeline simple

### Phase 2

* PDFs résumés
* Capital projects
* Notifications

### Phase 3

* Extension NYC
* Comparaison inter-quartiers
* Analyse historique longue

---

## 18. Message produit assumé

> "Comprendre comment la ville change, avant que ça se voie."

---
