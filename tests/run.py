#!/usr/bin/env python3
"""Run the calculation tests against the site's engine, web/lib/engine/.

The engine's figures come first: web/lib/engine/data/, each tax year's file
and the year-independent ones, in the order data/index.js imports them. The
engine is web/lib/engine/math.js (between its ===MATH START=== and
===MATH END=== markers), the Drawdown Simulator's engine, drawdown.js
(between ===DRAWDOWN START=== and ===DRAWDOWN END===), the retirement plan
engine, plan.js (between ===PLAN START=== and ===PLAN END===), and a few
calculators in calculators.js, bridge.js and landing.js; their top-level
`export` keywords are dropped so it all runs as one script. A few defaults
the tests check live in the tools' TypeScript; tests/web-extras.mjs prints
those (it needs node). This puts all of it, the text of the "about this
tool" articles (whose worked examples the tests check) and
tests/math.test.js in one script, and runs it with whichever JavaScript
engine is here: jsc (built into macOS) or node (CI). The exit code is
nonzero when any test fails, which is what the pre-commit hook and the
GitHub workflow check.

    python3 tests/run.py
"""
import glob, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"

# Calculators outside the engine block that the tests cover, and the
# constants they read.
FUNCTIONS = ["rentBuyCalc", "collegeSavingsCalc", "collegePlanCalc", "collegeWalk", "brLE", "brAmortFactor", "projectBasic"]
CONSTANTS = ["PMI_DEFAULT", "DEFAULTS", "BASIC_INFL", "RISK_LEVELS", "DD_LANDING"]
WEB = os.path.join(ROOT, "web")
ARTICLES = os.path.join(WEB, "content", "articles")


def balanced(src, start, open_ch, close_ch):
    """Index just past the bracket that closes the one at src[start]."""
    depth = 0
    for i in range(start, len(src)):
        if src[i] == open_ch:
            depth += 1
        elif src[i] == close_ch:
            depth -= 1
            if depth == 0:
                return i + 1
    raise ValueError("unbalanced from %d" % start)


def function(src, name):
    m = re.search(r"\nfunction %s\(" % re.escape(name), src)
    if not m:
        sys.exit("tests/run.py: function %s not found in web/lib/engine/" % name)
    body = src.index("{", m.end())
    return src[m.start() + 1:balanced(src, body, "{", "}")]


def constant(src, name):
    m = re.search(r"\n(?:const|let|var) %s\s*=\s*" % re.escape(name), src)
    if not m:
        sys.exit("tests/run.py: constant %s not found in web/lib/engine/" % name)
    i = m.end()
    if src[i] in "[{":
        end = balanced(src, i, src[i], "]" if src[i] == "[" else "}")
    else:
        end = src.index(";", i)
    return "var %s = %s;" % (name, src[i:end].rstrip(";"))


def articles():
    """Each page's "about this tool" article as plain text, keyed by page, so
    the tests can check that a worked example's figures are what the
    calculator gives."""
    html = "".join(open(p, encoding="utf-8").read() for p in sorted(glob.glob(os.path.join(ARTICLES, "*.html"))))
    out = {}
    for m in re.finditer(r'<article[^>]*data-page="([^"]+)"[^>]*>(.*?)</article>', html, re.S):
        text = re.sub(r"<[^>]+>", " ", m.group(2)).replace("&amp;", "&")
        out[m.group(1)] = re.sub(r"\s+", " ", text)
    # the tests still call the calculator's article "home", as the old site did
    if "calculator" in out and "home" not in out:
        out["home"] = out["calculator"]
    return "var ARTICLES = %s;" % json.dumps(out)


def engine(name):
    """One engine module's text, web/lib/engine/<name>.js, its imports and
    top-level `export ` keywords removed."""
    text = open(os.path.join(WEB, "lib", "engine", name + ".js"), encoding="utf-8").read()
    text = re.sub(r"^import [^;]*;\n", "", text, flags=re.M | re.S)
    return re.sub(r"^export ", "", text, flags=re.M)


def data(name="index", seen=None):
    """The engine's figures, web/lib/engine/data/<name>.js and the files it
    imports, each after the ones it needs, as plain script: imports, the
    index's re-exports and the `export ` keywords removed."""
    seen = set() if seen is None else seen
    if name in seen:
        return []
    seen.add(name)
    text = open(os.path.join(WEB, "lib", "engine", "data", name + ".js"), encoding="utf-8").read()
    out = []
    for dep in re.findall(r'^(?:import|export \*) [^;]*?from "\./([\w-]+)\.js";', text, flags=re.M):
        out += data(dep, seen)
    text = re.sub(r"^(?:import|export \*) [^;]*;\n", "", text, flags=re.M)
    out.append(re.sub(r"^export ", "", text, flags=re.M))
    return out


def node():
    """node, from PATH or where it's installed on the site owner's Mac."""
    return shutil.which("node") or next((p for p in [os.path.expanduser("~/.local/node/bin/node")] if os.path.exists(p)), None)


def extras():
    """The defaults the tests check that live in the tools' TypeScript."""
    exe = node()
    if not exe:
        sys.exit("tests/run.py: node is needed to read the tools' defaults (tests/web-extras.mjs)")
    out = subprocess.run([exe, "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", os.path.join(ROOT, "tests", "web-extras.mjs")],
                         capture_output=True, text=True)
    if out.returncode:
        sys.exit("tests/run.py: tests/web-extras.mjs failed\n" + out.stderr)
    return out.stdout


def lastmod_ok():
    """Every page has a sitemap date in web/lib/lastmod.json
    (written by web/scripts/lastmod.mjs)."""
    import json, re
    pages = json.load(open(os.path.join(ROOT, "web", "lib", "page-meta.json"), encoding="utf-8"))["pages"]
    path = os.path.join(ROOT, "web", "lib", "lastmod.json")
    dates = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    bad = [k for k in pages if not re.fullmatch(r"\d{4}-\d\d-\d\d", str(dates.get(k, "")))]
    if bad:
        print("  FAIL  Sitemap dates missing for: " + ", ".join(bad) + " (run node web/scripts/lastmod.mjs)")
        return False
    print("  ok    Sitemap: every page has a lastmod date")
    return True


def main():
    if not lastmod_ok():
        return 1
    math = engine("math")
    src = "\n" + engine("calculators") + "\n" + engine("bridge") + "\n" + engine("landing") + "\n"
    a, b = math.index("// ===MATH START==="), math.index("// ===MATH END===")
    dd = engine("drawdown")
    e, f = dd.index("// ===DRAWDOWN START==="), dd.index("// ===DRAWDOWN END===")
    plan = engine("plan")
    c, d = plan.index("// ===PLAN START==="), plan.index("// ===PLAN END===")
    parts = data() + [math[a:b], dd[e:f], plan[c:d]]
    parts += [constant(src, c) for c in CONSTANTS]
    parts += [function(src, f) for f in FUNCTIONS]
    parts.append(extras())
    parts.append(articles())
    parts.append(open(os.path.join(ROOT, "tests", "math.test.js"), encoding="utf-8").read())

    fd, path = tempfile.mkstemp(suffix=".js", prefix="retcalc-tests-")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n;\n".join(parts))
    try:
        if os.path.exists(JSC):
            cmd = [JSC, path]
        elif shutil.which("node"):
            cmd = ["node", path]
        else:
            sys.exit("tests/run.py: no JavaScript engine found (jsc or node)")
        return subprocess.run(cmd).returncode
    finally:
        os.remove(path)


if __name__ == "__main__":
    sys.exit(main())
