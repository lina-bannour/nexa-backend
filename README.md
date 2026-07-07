# NEXA — Backend API

> Plateforme de révision pour les Classes Préparatoires Scientifiques Tunisiennes (MP, PC, TSI, Bio)

Backend NestJS connecté à PostgreSQL via Prisma, fournissant l'API REST complète pour l'application mobile/web NEXA.

---

## Stack technique

| Technologie | Rôle |
|---|---|
| **NestJS** | Framework backend (Node.js) |
| **PostgreSQL** | Base de données relationnelle |
| **Prisma** | ORM — schéma, migrations, client typé |
| **JWT + Passport** | Authentification et sessions |
| **bcrypt** | Hashage des mots de passe |
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
git clone https://github.com/YOURNAME/nexa-backend.git
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

# 5. Pousser le schéma vers la base de données
npx prisma db push
npx prisma generate

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
```

Un fichier `.env.example` est fourni comme modèle.

---

## Endpoints API

### Authentification
| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` | Inscription étudiant |
| POST | `/auth/login` | Connexion — retourne un JWT |

### Utilisateurs
| Méthode | Route | Description |
|---|---|---|
| GET | `/users/me` | Profil de l'utilisateur connecté |
| GET | `/users/leaderboard` | Classement par XP (`?filiere=MP`) |

### Exercices
| Méthode | Route | Description |
|---|---|---|
| GET | `/exercises` | Liste des exercices (`?matiere=MATHEMATIQUES&difficulte=UN_ETOILE`) |
| GET | `/exercises/:id` | Détail d'un exercice avec choix et indices |
| POST | `/exercises` | Créer un exercice (admin) |
| POST | `/exercises/:id/submit` | Soumettre une réponse — calcule l'XP |
| DELETE | `/exercises/:id` | Supprimer un exercice (admin) |

### Concours
| Méthode | Route | Description |
|---|---|---|
| GET | `/contests` | Liste des concours (`?filiere=MP`) |
| GET | `/contests/:id` | Détail d'un concours avec questions |
| POST | `/contests` | Créer un concours (admin) |
| POST | `/contests/:id/session` | Démarrer une session |
| POST | `/contests/sessions/:sessionId/questions/:questionId/submit` | Soumettre une réponse |
| GET | `/contests/sessions/:sessionId` | Progression de la session |

---

## Schéma de base de données

```
User ──────────── ExerciseAttempt ── Exercise ── ExerciseChoice
  │                                      └─────── ExerciseHint
  └── ContestSession ── ContestSessionAnswer ── ContestQuestion ── ContestQuestionChoice
```

Modèles principaux : `User`, `Exercise`, `ExerciseChoice`, `ExerciseAttempt`, `Contest`, `ContestQuestion`, `ContestQuestionChoice`, `ContestSession`, `ContestSessionAnswer`

---

## Structure du projet

```
src/
├── auth/           # Login, register, JWT guard, strategy
├── users/          # Profil, leaderboard
├── exercises/      # Banque d'exercices, soumission, XP
├── contests/       # Concours, sessions, correction instantanée
├── prisma/         # PrismaService (wrapper injectable)
└── main.ts         # Bootstrap, CORS, ValidationPipe
prisma/
└── schema.prisma   # Schéma complet de la BDD
```

---

## Logique XP et pénalités

| Action | XP |
|---|---|
| Réponse directe (0 indice) | xpBase × 100% |
| 1 indice utilisé | xpBase × 90% |
| 2 indices utilisés | xpBase × 80% |
| 3 indices utilisés | xpBase × 70% |
| 4 indices utilisés | xpBase × 60% |
| Mauvaise réponse | 0 XP |

---

## Développé dans le cadre du projet NEXA
Plateforme de révision pour les classes préparatoires scientifiques tunisiennes.
Frontend Flutter : [nexa-frontend](https://github.com/lina-bannour/nexa-frontend)