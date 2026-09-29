# RetCalc source

The site is one page, `index.html`, but it's written here in pieces so each
part can be found and changed on its own. `build.py` (in the repo root) puts
the pieces back together into `index.html`, exactly as the site ships, and
makes the per-tool copies (`drawdown.html`, `rmd.html`, ...), `sitemap.xml`
and `robots.txt` from it.

**Edit the files here, never `index.html` or the page copies.** The build
overwrites those, and refuses to run if `index.html` was edited by hand, so
the edit isn't silently lost.

## Layout

| Path | What it is |
|---|---|
| `page.html` | The page skeleton: `<head>`, masthead, footer, the pop-up panels, and `<!-- @include ... -->` lines where each piece below goes |
| `page-meta.json` | Every page's title and description. The build writes each page's `<head>` from it, and the app uses it for the browser-tab title |
| `css/*.css` | The styles, by area: base tokens, layout, fields, navigation, each tool, the guide, charts, footer and phone rules |
| `main/*.html` | Everything inside `<main>`: the household bar, each tool's inputs and results, About, the tool picker, the guide, and the "about this tool" articles |
| `js/math.js` | The calculation engine: projections, Monte Carlo, taxes, Social Security, RMDs and Roth conversions, mortgages, debt, drawdown and the historical data. Tested by `tests/math.test.js` |
| `js/app/*.js` | Everything else the page does, by area: inputs, charts, each tool's screen, navigation, sharing, saved scenarios, the readiness guide, tool help |

Files are joined in filename order, so the number prefix sets the order, and
**order matters**: CSS later in the list wins ties, and the app files run top
to bottom as one script. To add a file, pick a number that puts it where it
belongs (for example `15b-something.js` sorts between 15 and 16).

The app files together are the body of a single function, so they share one
scope: something defined in `00-core.js` (like `$`, `money` or `pctStr`) is
visible in every later file. They aren't separate modules and can't be loaded
on their own.

## Building

```
python3 build.py            # index.html, page copies, sitemap.xml, robots.txt
python3 build.py --cards    # the same, plus the link-preview images
python3 build.py --check    # does index.html match src/? (CI runs this)
python3 tests/run.py        # the calculation tests
```

A git pre-commit hook runs the tests and the build whenever `src/`, the tests
or the build are committed, and adds the rebuilt files to the same commit.
GitHub runs the tests and `--check` on every push.

To see a change in a browser, build, then serve the repo root, for example
`python3 -m http.server`, and open `/` or `/drawdown.html`.
