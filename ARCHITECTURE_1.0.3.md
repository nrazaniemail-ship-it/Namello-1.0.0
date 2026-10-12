# Namello 1.0.3 architecture roadmap

The current PWA remains deployable as a single-file runtime for compatibility. New logic is isolated under `src/modules` and covered by unit tests so migration to TypeScript + Vite can happen incrementally.

Modules:
- csv-import.ts: broker-neutral trade import normalization
- statistics.ts: deterministic trading statistics
- psychology.ts: behavioral metrics
- prop-firm.ts: challenge limits and status
- portfolio.ts: multi-account aggregation
- crypto.ts: WebCrypto contract surface

Migration order: pure functions -> statistics/crypto tests -> UI adapters -> React components -> Vite entry point.
