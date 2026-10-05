# RetCalc on Next.js

The Next.js rebuild of RetCalc, in progress. The plan, phases and checklist
are in [../MIGRATION.md](../MIGRATION.md); the live site is still built from
`../src/` until the switch.

    npm install
    npm run dev                      # http://localhost:3000
    npm run build && npm run lint
    python3 ../tests/run.py --web    # the calculation tests, against lib/engine/

`lib/engine/` is the calculation engine, moved from `../src/js/` unchanged.
Import it from `@/lib/engine`, never from one of its files directly.
`styles/` is today's CSS, unchanged until the redesign.
