// Registers the jest-dom matchers (`toBeInTheDocument`, `toHaveTextContent`, …)
// with Vitest's `expect` types.
//
// The runtime registration happens in `vitest-setup-client.ts`; this is the
// type-side half, and it lives under `src/` so it is guaranteed to be part of the
// program `svelte-check` uses.
import '@testing-library/jest-dom/vitest';
