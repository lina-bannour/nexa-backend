# NEXA — Backend API

> Plateforme de révision pour les Classes Préparatoires Scientifiques Tunisiennes (MP, PT, PC, BG)

Backend NestJS connecté à PostgreSQL via Prisma, fournissant l'API REST complète de NEXA : banque d'exercices avec indices progressifs, concours nationaux (mode QCM interactif et mode "photo de copie"), classement gamifié, forum communautaire, et back-office d'administration (analytics, gestion des utilisateurs, du contenu, de la modération et des réglages de la plateforme).

---

## Stack technique

| Technologie | Rôle |
|---|---|
| **NestJS 11** | Framework backend (Node.js / TypeScript) |
| **PostgreSQL** | Base de données relationnelle |
| **Prisma 7** | ORM — schéma, migrations, client typé (config via `prisma.config.ts`) |
| **Passport + JWT** | Authentification par token, guards `JwtAuthGuard` / `RolesGuard` |
| **bcrypt** | Hashage des mots de passe |
| **class-validator** | Validation des DTOs entrants |
| **Nodemailer** | Emails transactionnels (vérification de compte, réinitialisation de mot de passe) |
| **Jest** | Tests unitaires |
| **Docker** | Conteneurisation de la base de données |

---

## Prérequis

- Node.js v20+
- npm
- Docker Desktop (pour PostgreSQL)
- WSL2 (si développement sur Windows)

---

## Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/lina-bannour/nexa-backend.git
cd nexa-backend

# 2. Installer les dépendances
npm install

# 3. Créer le fichier d'environnement
cp .env.example .env
# Remplir les valeurs dans .env

# 4. Démarrer PostgreSQL
docker run --name nexa-postgres \
  -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=nexa_dev \
  -p 5432:5432 \
  -d postgres:16

# 5. Appliquer le schéma à la base de données
npx prisma migrate deploy
npx prisma generate

# (optionnel) peupler la base avec des données de démo
npx prisma db seed

# 6. Démarrer le serveur en mode développement
npm run start:dev
```

Le serveur démarre sur `http://localhost:3000`.

---

## Variables d'environnement

Créer un fichier `.env` à la racine (ne jamais committer ce fichier) :

```env
DATABASE_URL="postgresql://postgres:devpass@localhost:5432/nexa_dev"
JWT_SECRET="votre_secret_jwt_ici"
PORT=3000

# Envoi d'emails (vérification de compte, mot de passe oublié) — optionnel en dev
MAIL_HOST=""
MAIL_PORT=587
MAIL_USER=""
MAIL_PASS=""
MAIL_SECURE=false
MAIL_FROM="NEXA <no-reply@nexa.app>"
```

Un fichier `.env.example` est fourni comme modèle. `DATABASE_URL` est lu par `prisma.config.ts` (nouvelle configuration Prisma 7, plus par `url = env(...)` dans `schema.prisma`).

---

## Endpoints API

Toutes les routes marquées 🔒 nécessitent un JWT valide (`Authorization: Bearer <token>`). Celles marquées 👑 sont réservées au rôle `ADMIN`.

### Authentification (`/auth`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` | Inscription étudiant (email, mot de passe, école, filière) |
| POST | `/auth/login` | Connexion — retourne un JWT |
| POST | `/auth/forgot-password` | Envoie un email de réinitialisation |
| POST | `/auth/reset-password` | Réinitialise le mot de passe via le token reçu par email |
| POST | `/auth/verify-email` | Valide l'adresse email via le token reçu par email |
| POST | `/auth/resend-verification` | Renvoie l'email de vérification |

### Utilisateurs (`/users`) 🔒
| Méthode | Route | Description |
|---|---|---|
| GET | `/users/me` | Profil de l'utilisateur connecté |
| PUT | `/users/me` | Mettre à jour son profil (nom, école, filière) |
| GET | `/users/me/daily-missions` | Missions quotidiennes et statut de complétion |
| GET | `/users/leaderboard` | Classement par XP (`?filiere=MP&period=global\|semaine\|mois`) |
| GET | `/users/me/rank` | Rang de l'utilisateur connecté dans le classement (mêmes filtres) |

### Exercices (`/exercises`) 🔒
| Méthode | Route | Description |
|---|---|---|
| GET | `/exercises` | Liste des exercices (`?matiere=MATHEMATIQUES&difficulte=UN_ETOILE`) |
| GET | `/exercises/:id` | Détail d'un exercice avec choix et indices |
| POST | `/exercises/:id/check-answer` | Vérifie une réponse libre avant de révéler le QCM |
| POST | `/exercises/:id/submit` | Soumettre une réponse au QCM — calcule l'XP |
| POST 👑 | `/exercises` | Créer un exercice |
| DELETE 👑 | `/exercises/:id` | Supprimer un exercice |

### Concours (`/contests`) 🔒
| Méthode | Route | Description |
|---|---|---|
| GET | `/contests` | Liste des concours (`?filiere=MP`) |
| GET | `/contests/:id` | Détail d'un concours avec questions |
| POST | `/contests/:id/session` | Démarrer une session QCM |
| POST | `/contests/sessions/:sessionId/questions/:questionId/check-answer` | Vérifier une réponse libre avant le QCM |
| POST | `/contests/sessions/:sessionId/questions/:questionId/submit` | Soumettre une réponse — calcule l'XP |
| GET | `/contests/sessions/:sessionId` | Progression de la session |
| POST | `/contests/:id/photo-submissions` | Soumettre une photo de copie (mode "résoudre sur papier") |
| GET | `/contests/:id/photo-submissions/me` | Récupérer ma soumission photo pour ce concours |
| POST 👑 | `/contests` | Créer un concours |

### Forum (`/forum`) 🔒
| Méthode | Route | Description |
|---|---|---|
| GET | `/forum` | Liste des discussions (`?matiere=PHYSIQUE`) |
| GET | `/forum/:id` | Détail d'une discussion avec réponses |
| POST | `/forum` | Créer une discussion |
| POST | `/forum/:id/replies` | Répondre à une discussion |
| POST | `/forum/:id/like` | Liker une discussion |
| PATCH | `/forum/:id/report` | Signaler une discussion |

### Réglages publics (`/settings`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/settings/bareme` | Barème XP actuel (pénalités par indice, bonus réponse directe) |

### Administration 🔒 👑

**`/admin/dashboard`**
| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/dashboard` | KPIs globaux, répartition par filière, activité des 7 derniers jours |

**`/admin/users`**
| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/users` | Liste paginée des étudiants (`?search=&status=&ecole=&filiere=&page=&pageSize=`) |
| GET | `/admin/users/:id` | Détail d'un étudiant (XP, streak, exercices, dernière activité, progression) |
| PUT | `/admin/users/:id` | Modifier les informations d'un étudiant |
| PATCH | `/admin/users/:id/status` | Changer le statut (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `BANNED`) |
| PATCH | `/admin/users/:id/role` | Changer le rôle (`STUDENT`, `ADMIN`) |
| POST | `/admin/users/:id/message` | Envoyer un message ponctuel à un étudiant |

**`/admin/content`**
| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/content/exercises` | Liste des exercices (vue admin) |
| PUT | `/admin/content/exercises/:id` | Modifier un exercice |
| DELETE | `/admin/content/exercises/:id` | Supprimer un exercice |
| GET | `/admin/content/contests` | Liste des concours (vue admin) |
| PUT | `/admin/content/contests/:id` | Modifier un concours |
| DELETE | `/admin/content/contests/:id` | Supprimer un concours |

**`/admin/moderation`**
| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/moderation/stats` | Statistiques de modération du forum |
| GET | `/admin/moderation/reported` | Discussions signalées |
| GET | `/admin/moderation/posts` | Liste des discussions modérables |
| PATCH | `/admin/moderation/posts/:id/status` | Changer le statut d'une discussion (`PUBLISHED`, `REPORTED`, `REMOVED`) |

**`/admin/settings`**
| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/settings` | Réglages actuels de la plateforme |
| PUT | `/admin/settings` | Mettre à jour le barème XP et les réglages généraux |
| PATCH | `/admin/settings/maintenance` | Activer/désactiver le mode maintenance |

---

## Schéma de base de données

Modèles principaux (voir `prisma/schema.prisma` pour le détail complet) :

- **Comptes** — `User`, `PasswordResetToken`, `EmailVerificationToken`, `AdminMessage`
- **Exercices** — `Exercise`, `ExerciseChoice`, `ExerciseAttempt`
- **Concours** — `Contest`, `ContestQuestion`, `ContestQuestionChoice`, `ContestSession`, `ContestSessionAnswer`, `ContestPhotoSubmission`
- **Forum** — `ForumPost`, `ForumReply`, `ForumLike`
- **Gamification** — `DailyMissionClaim`
- **Plateforme** — `PlatformSettings`

Enums clés : `Role` (STUDENT / ADMIN), `UserStatus` (ACTIVE / INACTIVE / SUSPENDED / BANNED), `Filiere` (MP / PT / PC / BG), `Matiere` (MATHEMATIQUES / PHYSIQUE / SCIENCES_INGENIEUR / AUTRE), `Difficulte` (UN_ETOILE / DEUX_ETOILES / TROIS_ETOILES), `PostStatus`, `PhotoSubmissionStatus`.

---

## Structure du projet

```
src/
├── auth/            # Login, register, JWT guard/strategy, vérification email, mot de passe oublié
├── users/            # Profil, missions quotidiennes, leaderboard, rang
├── exercises/         # Banque d'exercices, soumission, XP
├── contests/          # Concours, sessions QCM, mode photo de copie
├── forum/            # Discussions, réponses, likes, signalements
├── settings/          # Barème XP public (lecture seule)
├── mail/             # Envoi d'emails transactionnels (Nodemailer)
├── middleware/        # Mode maintenance
├── admin/
│   ├── dashboard/     # KPIs et analytics
│   ├── users/        # Gestion des étudiants (CRUD, statut, rôle, messages)
│   ├── content/       # Édition des exercices et concours
│   ├── moderation/    # Modération du forum
│   └── settings/      # Barème XP, mode maintenance
├── prisma/            # PrismaService (wrapper injectable)
└── main.ts            # Bootstrap, CORS, ValidationPipe
prisma/
├── schema.prisma      # Schéma complet de la BDD
├── migrations/        # Historique des migrations SQL
└── seed.ts            # Données de démo
```

---

## Logique XP et pénalités

Le barème est **configurable via `/admin/settings`** (lecture publique sur `/settings/bareme`) — les valeurs ci-dessous sont les valeurs par défaut :

| Action | XP |
|---|---|
| Réponse correcte, 0 indice | `xpBase` × 100% + bonus "réponse directe" |
| Réponse correcte, 1 indice | `xpBase` × 90% |
| Réponse correcte, 2 indices | `xpBase` × 80% |
| Réponse correcte, 3 indices | `xpBase` × 70% |
| Réponse correcte, 4 indices (tous utilisés) | 1 XP forfaitaire |
| Mauvaise réponse | 0 XP |

Même logique appliquée aux questions de concours (`ContestSessionAnswer`).

---

## Tests

```bash
npm run test        # Tests unitaires (Jest)
npm run test:cov     # Avec couverture
npm run test:e2e     # Tests end-to-end
```

---

## Développé dans le cadre du projet NEXA
Plateforme de révision pour les classes préparatoires scientifiques tunisiennes.
Frontend Flutter : [nexa-frontend](https://github.com/lina-bannour/nexa-frontend)
