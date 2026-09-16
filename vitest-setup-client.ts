// Setup file for the `client` Vitest project (jsdom).
//
// Registers the jest-dom matchers — `toBeInTheDocument`, `toHaveTextContent` and
// friends — on Vitest's `expect`, so component tests can assert against the DOM
// the way Testing Library documents.
import '@testing-library/jest-dom/vitest';
