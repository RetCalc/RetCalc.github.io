#!/usr/bin/env python3
"""Run the calculation tests against the math in src/.

The engine is src/js/math.js (between its ===MATH START=== and ===MATH END===
markers), and a few calculators live in the app script, src/js/app/*.js.
This takes the engine block and the named extras, puts them in one script
with tests/math.test.js, and runs it with whichever
JavaScript engine is here: jsc (built into macOS) or node (CI). The exit
code is nonzero when any test fails, which is what the pre-commit hook and
the GitHub workflow check.

    python3 tests/run.py
"""
import glob, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"

# Calculators outside the engine block that the tests cover, and the
# constants they read.
FUNCTIONS = ["rentBuyCalc", "collegeSavingsCalc", "hcFPL", "hcAgeMultiplier",
             "hcGrossPremium", "hcContribPctStd", "hcCalcACA"]
CONSTANTS = ["PMI_DEFAULT", "HC_FPL_BASE", "HC_FPL_PER_ADDL", "HC_AGE_MULT",
             "HC_AGE40_MULT", "HC_STATE_PREMIUM_40"]


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
        sys.exit("tests/run.py: function %s not found in src/js/app/" % name)
    body = src.index("{", m.end())
    return src[m.start() + 1:balanced(src, body, "{", "}")]


def constant(src, name):
    m = re.search(r"\n(?:const|let|var) %s\s*=\s*" % re.escape(name), src)
    if not m:
        sys.exit("tests/run.py: constant %s not found in src/js/app/" % name)
    i = m.end()
    if src[i] in "[{":
        end = balanced(src, i, src[i], "]" if src[i] == "[" else "}")
    else:
        end = src.index(";", i)
    return "var %s = %s;" % (name, src[i:end].rstrip(";"))


def main():
    math = open(os.path.join(ROOT, "src", "js", "math.js"), encoding="utf-8").read()
    src = "".join(open(p, encoding="utf-8").read()
                  for p in sorted(glob.glob(os.path.join(ROOT, "src", "js", "app", "*.js"))))
    a, b = math.index("// ===MATH START==="), math.index("// ===MATH END===")
    parts = [math[a:b]]
    parts += [constant(src, c) for c in CONSTANTS]
    parts += [function(src, f) for f in FUNCTIONS]
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
