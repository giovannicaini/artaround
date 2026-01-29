# ArtAround

ArtAround is a comprehensive museum visit application that adapts to different user needs through a marketplace for content creation and a navigator for guided visits.

## 🏗️ Project Structure

```
artaround/
├── apps/
│   ├── server/          # Node.js + Express + MongoDB backend
│   ├── marketplace/     # Web Components frontend for content creators
│   └── navigator/       # React frontend for museum visitors
├── packages/
│   └── shared/         # Shared TypeScript types and utilities
├── turbo.json          # Turborepo configuration
└── package.json        # Root package with workspaces
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB (local or remote)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Setup environment variables:

```bash
cp .env.example .env.development
# Edit .env.development with your values
```

4. Seed the database (after MongoDB is running):

```bash
npm run seed
```

### Development

Run all apps in development mode:

```bash
npm run dev
```

This will start:
- **Server API**: http://localhost:8000/api
- **Marketplace**: http://localhost:8000/marketplace
- **Navigator**: http://localhost:8000/navigator

### Build

Build all apps for production:

```bash
npm run build
```

### Production

Start the production server:

```bash
npm run start
```

## 📦 Packages

### @artaround/shared

Shared TypeScript types and utilities used across all applications.

## 🔧 Available Scripts

- `npm run dev` - Start all apps in development mode
- `npm run build` - Build all apps for production
- `npm run start` - Start production server
- `npm run seed` - Seed database with initial data
- `npm run lint` - Lint all packages
- `npm run test` - Run tests
- `npm run clean` - Clean all build artifacts

## 🏛️ Features

### Navigator (Visitor App)
- Museum and visit selection
- Interactive 2D/3D maps
- Text-to-speech content delivery
- Voice commands
- Multi-language support with AI translations
- Adaptive content based on user preferences

### Marketplace (Content Creator App)
- Create and manage museum items
- Create and organize visits
- Wikidata integration for artwork metadata
- Multi-content editor (duration × language levels)
- AI-powered translations
- Publish and manage content sales

### Server (Backend API)
- RESTful API with Express
- MongoDB with Mongoose
- JWT authentication
- Wikidata API integration
- AI translation service
- Content marketplace

## 🌐 Tech Stack

- **Backend**: Node.js, Express, TypeScript, MongoDB, Mongoose
- **Marketplace**: Web Components, Lit, Tailwind CSS, Vite
- **Navigator**: React, TypeScript, Tailwind CSS, Zustand, Leaflet
- **Monorepo**: Turborepo
- **AI**: OpenAI/Claude for translations and natural language processing
- **External APIs**: Wikidata

## 📄 License

Private project

## 👥 Default Users (Development)

After seeding, you can login with:

- **Author 1**: `autore1` / `12345678`
- **Author 2**: `autore2` / `12345678`
- **Visitor 1**: `visitatore1` / `12345678`
- **Visitor 2**: `visitatore2` / `12345678`

## 📚 Documentation

See the `ROADMAP.txt` file for detailed development plan and progress tracking.
