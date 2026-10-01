#!/usr/bin/env python3
"""Build the site from src/.

The site is one page. Its source is split across src/ so each part can be
read and changed on its own; this puts it back together:

  1. src/page.html is the page skeleton. Each line of the form
         <!-- @include main/*.html -->
     is replaced by the files it names (relative to src/), in filename order,
     so the numeric prefixes (00-, 01-...) set the order.
  2. The styles (src/css/) and the script (src/js/math.js, drawdown.js and plan.js, then
     the app in src/js/app/ wrapped in one function) become two shared files,
     assets/app.<hash>.css and assets/app.<hash>.js, which the page's
     <!-- @asset --> and <!-- @preload --> lines link to. Every page uses the
     same two files, so a visitor downloads them once; the hash in the name
     changes whenever their content does, so no browser keeps an old copy.
     The Plan Optimizer's worker, assets/plan.<hash>.js, is built alongside.
  3. Each address gets its own page: index.html for /, and a copy per clean
     URL (drawdown.html, rmd.html, ...) since GitHub Pages serves
     drawdown.html for /drawdown. Each has its own <head> from
     src/page-meta.json (title, description, canonical URL, preview tags,
     structured data), its own main heading, and only its own "about this
     tool" article. Plus sitemap.xml and robots.txt.
  4. With --cards, each page's 1200x630 link-preview card is rendered from
     og/template.html with headless Chrome.

index.html, the page copies and assets/ are generated: edit src/, never
them. The build refuses to overwrite an index.html that was changed by hand
since it last wrote it (.build-stamp), so an edit made there can't be
silently lost.

    python3 build.py            # pages, assets, sitemap, robots
    python3 build.py --cards    # the same, plus preview cards
    python3 build.py --check    # exit 1 if the built site doesn't match src/
    python3 build.py --force    # overwrite a hand-edited index.html

The pre-commit hook runs it, and the tests, whenever src/ is committed.
"""
import glob, hashlib, html, json, os, re, subprocess, sys, tempfile, time, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
INDEX = os.path.join(ROOT, "index.html")
STAMP = os.path.join(ROOT, ".build-stamp")
SITE = "https://retcalc.app"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ASSETS = os.path.join(ROOT, "assets")
INCLUDE = re.compile(r"^<!-- @include (\S+) -->$")
ASSET = re.compile(r"^<!-- @(asset|preload) (app\.(?:css|js)) -->$", re.M)

# path: (name on the card, card subtitle). Page titles and descriptions live
# in src/page-meta.json, which the app also reads for its own titles.
CARDS = {
    "drawdown": ("Drawdown Simulator",
        "Will your money last? Test withdrawal strategies against every retirement since 1926."),
    "4-percent-rule": ("4% Rule Calculator",
        "Does 4% still work? Test it against every retirement since 1926, and find your own safe rate."),
    "guardrails": ("Guardrails Calculator",
        "Guyton-Klinger guardrails: start higher, cut when markets fall. How deep did the cuts go?"),
    "vpw": ("VPW Calculator",
        "Variable percentage withdrawal: spend it all by the end, never run out. How low did it go?"),
    "vanguard-dynamic-spending": ("Vanguard Dynamic Spending",
        "A share of the portfolio, but spending moves at most +5% or −2.5% a year. Tested since 1926."),
    "risk-based-guardrails": ("Risk-Based Guardrails",
        "Change spending only when the odds of lasting leave a band. How often did it move, and how far?"),
    "rmd-withdrawal-strategy": ("RMD Withdrawal Strategy",
        "Spend the balance divided by the IRS life-expectancy divisor, every year. Tested since 1926."),
    "ratcheting-withdrawal": ("Ratcheting Withdrawals",
        "The 4% rule with raises: 10% more whenever the portfolio is up 50%. How often did they come?"),
    "cape-withdrawal": ("CAPE-Based Withdrawals",
        "Spend more when stocks are cheap, less when they're dear. Today's rate, and how it did since 1926."),
    "optimizer": ("Plan Optimizer",
        "When to claim, what to withdraw, what to convert: thousands of plans, every market since 1926."),
    "bridge": ("Early Retirement Bridge",
        "Retiring before 59½? Compare a Roth ladder, 72(t), the rule of 55 and your brokerage."),
    "72t": ("72(t) Calculator",
        "Penalty-free IRA payments before 59½, sized and tested against every market since 1926."),
    "backtest": ("Portfolio Backtest",
        "Pick a stock and bond mix and see what it actually did, every year back to 1926."),
    "incometax": ("Income Tax",
        "Your 2026 federal, state and FICA tax, on a salary or on a year of retirement withdrawals."),
    "roth": ("Roth Conversion & RMDs",
        "Project required distributions to 100, then test a conversion schedule against doing nothing."),
    "rmd": ("RMD Calculator",
        "Your required minimum distributions every year to 100, and what converting first would save."),
    "mortgage": ("Mortgage Calculator",
        "Your monthly payment, how the balance falls, and the amortization year by year."),
    "college": ("College Savings",
        "How much to save each month to cover tuition, from state school to elite."),
    "rentbuy": ("Rent vs. Buy",
        "Buyer and renter net worth over any horizon, down payment and home value included."),
    "budget": ("Budget",
        "Lay out your income and expenses, see what's left, and find out where your money goes."),
    "debt": ("Debt Payoff",
        "List what you owe, then watch the avalanche and snowball methods race to your payoff date."),
    "healthcare": ("Healthcare Cost Planner",
        "ACA premiums and subsidies before Medicare, then Part B, Part D and IRMAA by income."),
    "fire": ("FIRE Calculator",
        "Find when your portfolio reaches financial independence, or when you can coast."),
    "advanced": ("Advanced Calculator",
        "Growth, inflation, taxes, fees and market swings, with account types and a glide path."),
    "stages": ("Stages Calculator",
        "Save in stages, with different contributions, returns and mixes as life changes."),
    "guide": ("Retirement Readiness Guide",
        "One question at a time: a readiness score out of 100, a plan, and what to do next."),
    "tools": ("Retirement Tools",
        "Drawdown, taxes, Roth conversions, healthcare, FIRE, budgets and more."),
}
# Old addresses that still open a tab: a copy of the page they now point to,
# canonical to it, and left out of the sitemap.
ALIASES = {"single": "advanced", "series": "stages"}
# Pages that use the site's own card.
PLAIN = {"home", "about"}
# Pages that open a tool, and the tool (the picker card's data-pick) where
# the address differs from it. Their main heading is the tool's title.
TOOL_SUB = {"drawdown": "drawdown", "4-percent-rule": "drawdown", "guardrails": "drawdown", "vpw": "drawdown",
            "vanguard-dynamic-spending": "drawdown", "risk-based-guardrails": "drawdown", "rmd-withdrawal-strategy": "drawdown",
            "ratcheting-withdrawal": "drawdown", "cape-withdrawal": "drawdown", "bridge": "bridge", "72t": "bridge", "roth": "roth", "rmd": "roth",
            "healthcare": "healthcare", "fire": "fire", "backtest": "backtest", "incometax": "tax",
            "mortgage": "mortgage", "rentbuy": "rentbuy", "college": "college", "budget": "budget",
            "debt": "debt", "optimizer": "optimizer"}


# ---------------------------------------------------------------- assembly
def files(pattern):
    found = sorted(glob.glob(os.path.join(SRC, pattern)))
    if not found:
        sys.exit("build.py: %s matched no files" % pattern)
    out = []
    for p in found:
        text = open(p, encoding="utf-8").read()
        out.append(text if text.endswith("\n") else text + "\n")
    return "".join(out)


def bundles():
    """The shared files, by name. The app files are the body of one
    function, so they share a scope but leave nothing global; the engine
    before them (math.js, drawdown.js, plan.js) is global, for the app to use. The page is
    shown once the app has run, even if it threw (see page.html).

    The Plan Optimizer's search and the Drawdown Simulator's heavier
    searches run in a worker, which is the engine plus js/plan-worker.js in a
    file of its own, plan.<hash>.js. The app finds it through the
    @@PLAN_WORKER@@ placeholder, filled in before app.js is hashed, so a
    change to the engine renames both."""
    engine = files("js/math.js") + ";\n" + files("js/drawdown.js") + ";\n" + files("js/plan.js") + ";\n"
    worker = engine + files("js/plan-worker.js")
    worker_name = "plan.%s.js" % sha(worker)[:10]
    js = (engine +
          "try {\n(function(){\n\"use strict\";\n" + files("js/app/*.js") + "})();\n"
          "} finally { document.documentElement.classList.remove(\"booting\"); }\n")
    if "@@PLAN_WORKER@@" not in js:
        sys.exit("build.py: the app no longer refers to @@PLAN_WORKER@@")
    js = js.replace("@@PLAN_WORKER@@", "/assets/" + worker_name)
    out = {worker_name: worker}
    for name, text in (("app.css", files("css/*.css")), ("app.js", js)):
        base, ext = name.split(".")
        out["%s.%s.%s" % (base, sha(text)[:10], ext)] = text
    return out


def assemble(names):
    """src/page.html with every @include line replaced by its files, and the
    @asset and @preload lines pointing at the shared files."""
    out = []
    with open(os.path.join(SRC, "page.html"), encoding="utf-8") as f:
        for ln in f:
            m = INCLUDE.match(ln.rstrip("\n"))
            out.append(files(m.group(1)) if m else ln)
    page = "".join(out)
    href = {n.split(".")[0] + "." + n.split(".")[-1]: "/assets/" + n for n in names if n.startswith("app.")}
    def link(m):
        kind, name = m.group(1), m.group(2)
        if kind == "preload":
            return '<link rel="preload" href="%s" as="script">' % href[name]
        if name.endswith(".css"):
            return '<link rel="stylesheet" href="%s">' % href[name]
        return '<script src="%s"></script>' % href[name]
    return ASSET.sub(link, page)


def meta_of(page):
    m = re.search(r'<script type="application/json" id="pageMeta">(.*?)</script>', page, re.S)
    return json.loads(m.group(1))["pages"]


# ---------------------------------------------------------------- <head>s
def url_for(slug):
    return SITE + "/" if slug == "home" else SITE + "/" + slug


def faq(page, slug):
    """The article's questions, for FAQPage structured data."""
    m = re.search(r'<article class="seo-a[^"]*" data-page="%s"[^>]*>(.*?)</article>' % re.escape(slug), page, re.S)
    if not m:
        return []
    text = lambda t: html.unescape(re.sub(r"<[^>]+>", "", t)).strip()
    return [{"@type": "Question", "name": text(q), "acceptedAnswer": {"@type": "Answer", "text": text(a)}}
            for q, a in re.findall(r"<details><summary>(.*?)</summary><p>(.*?)</p></details>", m.group(1), re.S)]


def head(page, slug, meta, canon_slug):
    title, desc = meta["title"], meta["desc"]
    card = SITE + "/og.png" if slug in PLAIN else SITE + "/og/" + slug + ".jpg"
    alt = "RetCalc: know your number." if slug in PLAIN else CARDS[slug][0] + ": " + CARDS[slug][1]
    url = url_for(canon_slug)
    graph = [{"@type": "WebApplication", "name": title.split(" | ")[0], "url": url,
              "description": desc, "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}]
    if url == SITE + "/":
        # Google takes the name shown above the address in search results from this
        graph.insert(0, {"@type": "WebSite", "name": "RetCalc", "url": url})
    q = faq(page, slug)
    if q:
        graph.append({"@type": "FAQPage", "mainEntity": q})
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False)
    e = html.escape
    return "\n".join([
        "<!--PAGE-HEAD-->",
        "<title>%s</title>" % e(title),
        '<meta name="description" content="%s">' % e(desc),
        '<link rel="canonical" href="%s">' % url,
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="RetCalc">',
        '<meta property="og:title" content="%s">' % e(title),
        '<meta property="og:description" content="%s">' % e(desc),
        '<meta property="og:url" content="%s">' % url,
        '<meta property="og:image" content="%s">' % card,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="%s">' % e(alt),
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:image" content="%s">' % card,
        '<script type="application/ld+json">%s</script>' % ld.replace("</", "<\\/"),
        "<!--/PAGE-HEAD-->"])


def with_head(page, slug, meta, canon_slug):
    return re.sub(r"<!--PAGE-HEAD-->.*?<!--/PAGE-HEAD-->",
                  lambda m: head(page, slug, meta, canon_slug), page, count=1, flags=re.S)


def only_article(page, slug):
    """The page with just this address's article, shown without script. The
    others would be hidden anyway; leaving them out keeps each page about
    one thing, and lighter."""
    def keep(m):
        if m.group(1) != slug:
            return ""
        return m.group(0).replace(" hidden>", ">", 1)
    return re.sub(r'\n  <article class="seo-a[^"]*" data-page="([^"]+)" hidden>.*?</article>', keep, page, flags=re.S)


def card_text(page, sub, part):
    """A tool card's name or description, as the picker has it."""
    at = page.index('data-pick="%s"' % sub)
    m = re.compile(r'<div class="toolcard-%s">(.*?)</div>' % part, re.S).search(page, at)
    return re.sub(r"<span.*", "", m.group(1)).strip()


def headings(page, slug, meta):
    """The page's one h1: the tool's title in its header on a tool's page,
    the hidden #pageH1 everywhere else. The app keeps both current as you
    move around; this puts them in the page for anything that reads it
    without running the script."""
    sub = TOOL_SUB.get(slug)
    if not sub:
        return page.replace('<h1 class="srlive" id="pageH1"></h1>',
                            '<h1 class="srlive" id="pageH1">%s</h1>' % html.escape(meta.get("h1", "RetCalc")), 1)
    name = html.escape(meta["h1"]) if "h1" in meta else card_text(page, sub, "name")
    for a, b in (('<h1 class="srlive" id="pageH1"></h1>', '<h1 class="srlive" id="pageH1" hidden></h1>'),
                 ('<div class="toolback" id="toolBack" hidden>', '<div class="toolback" id="toolBack">'),
                 ('<h1 class="toolhead-name" id="toolCrumb"></h1>', '<h1 class="toolhead-name" id="toolCrumb">%s</h1>' % name),
                 ('<p class="toolhead-desc" id="toolHeadDesc"></p>',
                  '<p class="toolhead-desc" id="toolHeadDesc">%s</p>' % card_text(page, sub, "desc"))):
        if a not in page:
            sys.exit("build.py: page.html no longer has " + a)
        page = page.replace(a, b, 1)
    return page


def page_for(base, slug, meta, canon_slug):
    """The finished page at an address, from the assembled page."""
    return headings(only_article(with_head(base, slug, meta, canon_slug), slug), slug, meta)


# ---------------------------------------------------------------- cards
def render_card(path, name, sub):
    """og/<path>.jpg from og/template.html. Chrome's headless screenshot can
    hang after writing, so it's given a fixed window and then stopped."""
    png = os.path.join(tempfile.gettempdir(), "retcalc-og-%s.png" % path)
    if os.path.exists(png):
        os.remove(png)
    q = urllib.parse.urlencode({"h": name, "p": sub}) if name else ""
    p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--virtual-time-budget=4000", "--window-size=1200,630", "--screenshot=" + png,
        "file://" + os.path.join(ROOT, "og", "template.html") + ("?" + q if q else "")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        if os.path.exists(png) and os.path.getsize(png) > 0:
            time.sleep(0.5)
            break
        time.sleep(0.5)
    p.kill()
    if not os.path.exists(png):
        sys.exit("build.py: no card rendered for " + path)
    if not name:                      # the site's own card stays a PNG
        subprocess.run(["cp", png, os.path.join(ROOT, "og.png")], check=True)
        return
    # JPEG keeps each card near 100 KB instead of ~400 KB as PNG.
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "85", png,
        "--out", os.path.join(ROOT, "og", path + ".jpg")], check=True, stdout=subprocess.DEVNULL)


# ---------------------------------------------------------------- main
def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_if_changed(path, text):
    try:
        if open(path, encoding="utf-8").read() == text:
            return
    except FileNotFoundError:
        pass
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def main():
    args = set(sys.argv[1:])
    assets = bundles()
    base = assemble(assets)
    meta = meta_of(base)
    index = page_for(base, "home", meta["home"], "home")

    if "--check" in args:
        stale = [n for n, t in assets.items()
                 if not os.path.exists(os.path.join(ASSETS, n)) or open(os.path.join(ASSETS, n), encoding="utf-8").read() != t]
        if open(INDEX, encoding="utf-8").read() != index or stale:
            sys.exit("build.py --check: the built site doesn't match src/. Run python3 build.py.")
        print("index.html and assets/ match src/")
        return

    if os.path.exists(INDEX) and os.path.exists(STAMP) and "--force" not in args:
        current = open(INDEX, encoding="utf-8").read()
        if sha(current) != open(STAMP).read().strip() and current != index:
            sys.exit("build.py: index.html was edited directly since the last build, and the build would\n"
                     "overwrite that edit. Make the change in src/ instead, or run with --force to discard it.")
    os.makedirs(ASSETS, exist_ok=True)
    for old in glob.glob(os.path.join(ASSETS, "app.*")) + glob.glob(os.path.join(ASSETS, "plan.*")):
        if os.path.basename(old) not in assets:
            os.remove(old)
    for n, t in assets.items():
        write_if_changed(os.path.join(ASSETS, n), t)
    write_if_changed(INDEX, index)
    with open(STAMP, "w") as f:
        f.write(sha(index) + "\n")

    n = 0
    for slug, m in meta.items():
        if slug == "home":
            continue
        write_if_changed(os.path.join(ROOT, slug + ".html"), page_for(base, slug, m, slug))
        n += 1
    for old, slug in ALIASES.items():
        write_if_changed(os.path.join(ROOT, old + ".html"), page_for(base, slug, meta[slug], slug))
        n += 1
    write_if_changed(os.path.join(ROOT, "sitemap.xml"),
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "".join("  <url><loc>%s</loc></url>\n" % url_for(s) for s in meta) + "</urlset>\n")
    write_if_changed(os.path.join(ROOT, "robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE)

    if "--cards" in args:
        render_card("home", None, None)
        for slug in meta:
            if slug not in PLAIN:
                render_card(slug, *CARDS[slug])
                print("card", slug)
    print("built index.html, %d page copies, %s, sitemap.xml, robots.txt" % (n, " and ".join("assets/" + a for a in sorted(assets))))


if __name__ == "__main__":
    main()
