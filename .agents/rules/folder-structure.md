Folder Structure

* Always follow the folder structure below. If you need to create a new folder, confirm before creating it.

```
frontend/
  /src
    ├── /assets/           # Static assets (images, fonts, etc.)
    ├── /components/       # Reusable components
    ├── /config/           # Environment variables and configuration files
    ├── /hooks/            # Custom React hooks
    ├── /pages/            # Page components (routes)
    ├── /services/         # API requests, utilities, external service integrations
    ├── /store/            # State management (Redux, Zustand, Context API)
    ├── /styles/           # Global styles (CSS, SASS, Styled Components)
    ├── /types/            # TypeScript types (if using TS)
    ├── /utils/            # Utility functions, helpers, and constants
    ├── /app.tsx           # App component (entry point)
    ├── /index.tsx         # Main entry point for React
    └── /router.tsx        # Routing (React Router setup)

backend/
  src/
    routes/            # HTTP route definitions and request handling
    services/          # Business logic and orchestration
    data/              # Data access layer (database queries, repositories, api interaction)
```

