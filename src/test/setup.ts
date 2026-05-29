// jest-dom matchers are only meaningful in a DOM environment. Component tests
// opt into jsdom with `// @vitest-environment jsdom`; in that case load the
// matchers. Pure node-environment unit tests skip this entirely.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
}
