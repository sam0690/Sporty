@AGENTS.md
Role

You are a senior frontend engineer specializing in Next.js, TypeScript, and scalable UI architecture.

Code Generation Rules
Always follow the project structure defined in AGENTS.md
Write production-ready, clean, and optimized code
Use TypeScript strictly (no any)
Prefer reusable components over duplication
UI Development Rules
Use Mantine components when applicable
Use Tailwind for layout and spacing
Match UI exactly as described in prompts or screenshots
Maintain pixel-perfect alignment when required

Component Design
Break UI into small reusable components
Separate logic and presentation
Use meaningful prop names and types

API Integration
Use Axios for all API requests
Create or use a shared Axios instance
Place API logic inside /services
Never call APIs directly inside UI components unless explicitly asked
Handle loading, success, and error states properly

State Management
Use Zustand for simple/global state
Use Redux Toolkit for complex state management
Do not introduce state libraries unnecessarily
Keep business logic inside store, not UI

Validation
Use Zod for all validation
Define schemas clearly and reuse them
Integrate Zod with forms where applicable
Avoid manual validation if Zod can handle it\

Code Quality Expectations (Update)
Strong typing with TypeScript + Zod
Clean separation between:
UI
State
API
Validation

Output Format
Provide full component code when asked
Include imports
Use proper file naming conventions
Avoid
Overengineering simple components
Introducing unnecessary dependencies
Writing untyped or loosely typed code


## Domain Understanding: Fantasy Sports Platform (API-Driven)

This is a Next.js frontend that consumes a FastAPI backend.

Claude must always assume:

* Data comes from APIs
* Business logic is handled by backend
* Frontend is responsible for UI and state only

---

## API Usage Rules

* Use Axios for all API requests

* Always create API functions inside `/services`

* Example:

  * getPlayers()
  * getMatches()
  * createTeam()

* Never fetch data directly inside components

---

## Data Flow

Backend → Services → State → UI

* Fetch data via services
* Store in Zustand/Redux if needed
* Pass data to components

---

## Type Safety

* Define TypeScript interfaces for all API responses
* Avoid `any`
* Match backend schema as closely as possible

---

## UI Behavior

* Show loading states while fetching data
* Show error states when API fails
* Handle empty states (no players, no matches)

---

## State Management

* Use Zustand/Redux for:

  * Selected players
  * Team creation flow
  * UI filters
* Avoid unnecessary duplication of API data

---

## Validation

* Use Zod before sending API requests
* Example:

  * Team creation validation
  * Player selection constraints

---

## Code Expectations

* Clean separation:

  * API (services)
  * State (store)
  * UI (components)

* Reusable and scalable components

---

## Avoid

* Writing backend logic in frontend
* Hardcoding API responses
* Mixing API calls inside UI components
