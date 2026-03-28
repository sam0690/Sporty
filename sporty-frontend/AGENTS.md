
Project Overview

This is a Next.js (App Router) project using TypeScript, Tailwind CSS, and Mantine UI.

The project follows a modular, scalable architecture with reusable components and strict separation of concerns.

Tech Stack
Next.js (App Router)
TypeScript
Tailwind CSS
Mantine UI
Axios (API requests)
Zustand or Redux (state management)
Zod (validation)
API & Data Fetching
Use Axios for all API calls
Create a centralized Axios instance (/services/api.ts)
Do not call APIs directly inside components
Use services layer (/services)
Handle errors and responses consistently
State Management
Use Zustand for lightweight/global state
Use Redux Toolkit for complex/global state
Avoid unnecessary global state
Keep state logic outside UI components
Validation
Use Zod for all form and schema validation
Define schemas in /schemas or alongside features
Avoid manual validation logic when Zod can be used

Folder Structure Rules
/app → Routing (Next.js App Router)
/components → Reusable UI components
/features → Feature-based modules 
/hooks → Custom hooks
/services → API calls and business logic
/types → TypeScript types
/utils → Helper functions
/services → API calls using Axios
/store → Zustand or Redux store
/schemas → Zod validation schemas

Coding Guidelines
General
Always use TypeScript (no any)
Use functional components with hooks
Prefer composition over prop drilling
Components
Use PascalCase for component names
Keep components small and reusable
Separate UI and logic (container vs presentational)
Styling
Use Tailwind for layout and spacing
Use Mantine for UI components (Stepper, Modal, etc.)
Avoid inline styles unless necessary
State Management
Use React hooks or Zustand (if needed)
Avoid unnecessary global state
API & Data Fetching
Use services layer (/services)
Do not call APIs directly inside components
Use async/await with proper error handling
Naming Conventions
Components: AutoLoanBenefit.tsx
Hooks: useAutoLoan.ts
Services: loanService.ts
UI Consistency Rules
Follow existing design patterns
Maintain spacing, typography, and alignment consistency
Reuse shared components whenever possible
Performance
Use dynamic imports where needed
Avoid unnecessary re-renders
Use memoization when required
What to Avoid
Do not create duplicate components
Do not mix business logic inside UI components
Do not hardcode values that should be dynamic
Output Expectations for AI
Clean, readable, production-ready code
Proper TypeScript types
Reusable and scalable structure



## Domain Context: Fantasy Sports Platform (Frontend + FastAPI Backend)

This project is a Next.js frontend for a multi-sport fantasy league system.

The backend is built using FastAPI and provides all data via APIs.

The frontend must strictly consume backend APIs and should not implement business logic locally.

---

## API Integration

* Use Axios for all API calls
* Use a centralized Axios instance (`/services/api.ts`)
* Base URL should point to FastAPI backend
* All API calls must go through `/services` layer
* Do NOT call APIs directly inside components

---

## Data Handling

* Always fetch data from backend APIs
* Do NOT use mock data unless explicitly required for fallback/testing
* Follow backend response structure strictly
* Use TypeScript interfaces for API responses

---

## State Management

* Use Zustand or Redux for:

  * User session data
  * Selected team
  * Player selections
  * Leaderboards and scores
* Do not duplicate backend state unnecessarily

---

## Validation

* Use Zod for:

  * Form validation
  * Client-side constraints (before API calls)
* Backend remains source of truth

---

## Architecture Expectations

* `/services` → API calls (Axios)
* `/types` → API response types
* `/store` → Zustand/Redux state
* `/features` → UI + feature logic

---

## Error Handling

* Handle API errors gracefully
* Show loading and error states in UI
* Do not crash UI on failed requests

---

## What to Avoid

* Do NOT hardcode data
* Do NOT duplicate backend logic (e.g., scoring rules)
* Do NOT tightly couple UI with API responses (use adapters if needed)
