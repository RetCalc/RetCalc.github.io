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
The redesign is under way: Tailwind v4 and shadcn/ui, checked by
@shadcn/lint (`npm run lint` fails on any warning; `npm run typecheck`
too). Components come from `npx shadcn@latest add <name>` into
`components/ui/`, and their look lives there: call sites only place them.
Theme colors are tokens in `app/globals.css`. `styles/` is the old CSS, in a
layer below the utilities, shrinking as each primitive moves over.
