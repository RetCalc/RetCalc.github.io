# RetCalc

The site at retcalc.app: Next.js on Vercel, deployed from `main`.

    npm install
    npm run dev                      # http://localhost:3000
    npm run build && npm run lint
    python3 ../tests/run.py          # the calculation tests, against lib/engine/

`lib/engine/` is the calculation engine. Import it from `@/lib/engine`, never
from one of its files directly.
The look is Tailwind v4 and shadcn/ui, checked by @shadcn/lint (`npm run lint`
fails on any warning; `npm run typecheck` too). Components come from
`npx shadcn@latest add <name>` into `components/ui/`, and their look lives
there: call sites only place them. Theme colors are tokens in
`app/globals.css`. `styles/` is the older CSS, in a layer below the
utilities, shrinking as each primitive moves over.

## The first version

Until 5 October 2026 retcalc.app was a static site built from `src/` by
`build.py`. It now lives on its own in the private repo
[RetCalc/retcalc-v1](https://github.com/RetCalc/retcalc-v1), kept to compare
with. Comments here that say something was ported or moved "from
src/js/app/..." or "from build.py" point into that repo; nothing in this one
reads it.
