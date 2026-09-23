# Ticketing Priority System

A Kanban board that recommends a priority for support tickets using Jev, a System One model from TypeSafe AI.

Drag a ticket into **In Review** and the board sends it to Jev for scoring. While the request runs, the ticket shows a `Scoring…` badge. When scoring finishes, the badge shows the suggested priority and Jev's confidence, for example `Recommend: high (87%)`. Click the badge to apply that priority.

## How it works

- `src/routes/+page.svelte` holds the Kanban board. It uses drag and drop from `svelte-dnd-action`. Tickets are hardcoded, and only the ones in **In Review** get sent for scoring.
- `src/routes/api/prioritize/+server.ts` receives the tickets. It asks Jev one `choice` question per ticket (`high`, `medium` or `low`) and returns the chosen priority. The confidence is the probability of that choice, as a percentage.

## Tech stack

- SvelteKit 5 + TypeScript
- Tailwind CSS v4 + shadcn-svelte
- svelte-dnd-action
- `@typesafe-ai/sdk`

## Prerequisites

- [Bun](https://bun.sh) (or Node.js 20+ with npm)
- A TypeSafe AI API key

## Setup

1. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/raihandotmd/ticketing-priority-system.git
   cd ticketing-priority-system
   bun install
   ```

2. Create a `.env` file from the example and add your API key:

   ```sh
   cp .env.example .env
   ```

   ```env
   TYPESAFE_API_KEY=your-api-key
   ```

3. Start the development server:

   ```sh
   bun run dev
   ```

   Open http://localhost:5173.

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `bun run dev`     | Start the dev server           |
| `bun run build`   | Build for production           |
| `bun run preview` | Preview the production build   |
| `bun run check`   | Type-check with svelte-check   |
| `bun run lint`    | Run Prettier and ESLint checks |
| `bun run format`  | Format code with Prettier      |

## Notes

- The API key stays on the server (`$env/dynamic/private`) and is never sent to the browser.
- If `TYPESAFE_API_KEY` is missing, `/api/prioritize` returns a 500 error.
- The project uses `@sveltejs/adapter-auto`. To deploy, install the adapter for your hosting platform.
