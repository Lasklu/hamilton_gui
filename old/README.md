# Ontology Learning API Server

A high-quality, maintainable Node.js + TypeScript web server implementing the Ontology Learning API specification.

## Features

- 🚀 **Express.js** - Fast, unopinionated web framework
- 📘 **TypeScript** - Type-safe development
- 🛡️ **Security** - Helmet.js for security headers
- ✅ **Validation** - Express-validator for request validation
- 📝 **Logging** - Winston for structured logging
- 🔄 **Hot Reload** - Nodemon for development
- 📦 **File Upload** - Multer for handling multipart/form-data
- 🎯 **Clean Architecture** - Separation of concerns with controllers, services, and routes

## Project Structure

```
backend/
├── src/
│   ├── controllers/        # Request handlers
│   │   ├── databaseController.ts
│   │   ├── clusteringController.ts
│   │   └── ontologyController.ts
│   ├── services/           # Business logic
│   │   ├── databaseService.ts
│   │   ├── clusteringService.ts
│   │   └── ontologyService.ts
│   ├── routes/             # Route definitions
│   │   ├── index.ts
│   │   ├── databases.ts
│   │   ├── clustering.ts
│   │   └── ontology.ts
│   ├── middleware/         # Custom middleware
│   │   ├── errorHandler.ts
│   │   ├── notFoundHandler.ts
│   │   └── validateRequest.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── schemas.ts      # API schema types
│   │   └── errors.ts       # Custom error classes
│   ├── utils/              # Utility functions
│   │   └── logger.ts
│   ├── index.ts            # Application entry point
│   └── server.ts           # Server configuration
├── logs/                   # Log files (auto-generated)
├── uploads/                # Upload directory (auto-generated)
├── package.json
├── tsconfig.json
├── nodemon.json
├── .eslintrc.json
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your configuration:
```env
PORT=3000
NODE_ENV=development
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:5173
MAX_FILE_SIZE=10485760
LOG_LEVEL=info
```

### Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the PORT you specified).

### Production

Build the TypeScript code:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

### Linting

Run ESLint:
```bash
npm run lint
```

Fix linting errors automatically:
```bash
npm run lint:fix
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Databases
- `POST /api/v1/databases` - Upload database SQL script
- `GET /api/v1/databases/:databaseId` - Get database metadata

### Clustering
- `POST /api/v1/databases/:databaseId/cluster` - Suggest table clusters

### Ontology
- `POST /api/v1/ontology/concepts` - Generate ontology concepts
- `POST /api/v1/ontology/attributes` - Generate/augment attributes
- `POST /api/v1/ontology/relationships` - Generate relationships

## Implementation Guide

The server framework is complete with all routes, controllers, and service stubs. To implement the actual logic:

1. **Database Service** (`src/services/databaseService.ts`):
   - Implement SQL parsing and storage
   - Add database schema extraction
   - Implement database retrieval

2. **Clustering Service** (`src/services/clusteringService.ts`):
   - Implement table clustering algorithm
   - Add finetuning model integration

3. **Ontology Service** (`src/services/ontologyService.ts`):
   - Implement concept generation logic
   - Add attribute generation algorithm
   - Implement relationship inference

Each service method is documented with TODO comments indicating what needs to be implemented.

## Error Handling

The server uses a centralized error handling approach:

- Custom error classes in `src/types/errors.ts`
- Global error handler middleware in `src/middleware/errorHandler.ts`
- Consistent error response format matching the OpenAPI spec

## Logging

Winston logger is configured in `src/utils/logger.ts`:
- Console output with colors
- File output to `logs/error.log` and `logs/combined.log`
- Configurable log level via `LOG_LEVEL` environment variable

## Validation

Request validation using express-validator:
- Route-level validation in `src/routes/*.ts`
- Reusable validation middleware in `src/middleware/validateRequest.ts`
- Type-safe request bodies matching OpenAPI schema

## License

ISC
