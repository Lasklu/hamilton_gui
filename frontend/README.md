# Ontology Learning GUI - Frontend

A modern, responsive React + Next.js frontend for the Ontology Learning API.

## Features

- **Next.js 14** with App Router for modern React development
- **TypeScript** for type safety
- **Tailwind CSS** for responsive, utility-first styling
- **React Query** for efficient data fetching and caching
- **Zustand** for lightweight state management
- **React Hook Form + Zod** for form validation
- **Axios** for API communication
- **Component-based architecture** for maintainability

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── databases/          # Database management pages
│   │   ├── clustering/         # Clustering pages
│   │   └── ontology/           # Ontology generation pages
│   ├── components/             # Reusable components
│   │   ├── ui/                 # Base UI components
│   │   ├── database/           # Database-specific components
│   │   ├── clustering/         # Clustering components
│   │   └── ontology/           # Ontology components
│   ├── lib/                    # Utilities and configurations
│   │   ├── api/                # API client and services
│   │   ├── hooks/              # Custom React hooks
│   │   ├── store/              # Zustand stores
│   │   ├── types/              # TypeScript types
│   │   └── utils/              # Utility functions
│   └── styles/                 # Global styles
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API URL
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   http://localhost:3000

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Development Workflow

### Creating a New Feature

1. **Define types** in `src/lib/types/`
2. **Create API service** in `src/lib/api/services/`
3. **Build components** in `src/components/`
4. **Add pages** in `src/app/`
5. **Create custom hooks** in `src/lib/hooks/` if needed

### Component Guidelines

- Use functional components with hooks
- Keep components small and focused
- Separate UI from business logic
- Use TypeScript for props and state
- Follow naming conventions (PascalCase for components)

### State Management

- **Local state**: `useState` for component-local state
- **Server state**: React Query for API data
- **Global state**: Zustand for shared application state

## API Integration

The frontend connects to the Python backend API:

```typescript
// Example API call
import { apiClient } from '@/lib/api/client';

const database = await apiClient.databases.create({
  name: 'my-database',
  sqlFile: file,
});
```

## Styling

Using Tailwind CSS utility classes:

```tsx
<div className="flex items-center justify-between p-4 bg-primary-500 text-white rounded-lg">
  <h1 className="text-2xl font-bold">Title</h1>
</div>
```

## Building for Production

```bash
npm run build
npm start
```

## Deployment

The application can be deployed to:
- Vercel (recommended for Next.js)
- AWS Amplify
- Netlify
- Docker container

See [Next.js deployment docs](https://nextjs.org/docs/deployment) for details.
