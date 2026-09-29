#!/usr/bin/env python3
"""Build the site from src/.

The site is one page. Its source is split across src/ so each part can be
read and changed on its own; this puts it back together:

  1. src/page.html is the page skeleton. Each line of the form
         <!-- @include css/*.css -->
     is replaced by the files it names (relative to src/), in filename order,
     so the numeric prefixes (00-, 01-...) set the order. The result is
     index.html: one self-contained page, exactly as the site has always
     shipped, so nothing about how it loads or runs depends on the split.
  2. index.html's <head> is filled in from src/page-meta.json (title,
     description, canonical URL, preview tags, structured data).
  3. Every clean URL gets its own copy of the page (drawdown.html, rmd.html,
     ...) with that page's own <head>, since GitHub Pages serves
     drawdown.html for /drawdown. Plus sitemap.xml and robots.txt.
  4. With --cards, each page's 1200x630 link-preview card is rendered from
     og/template.html with headless Chrome.

index.html and the page copies are generated: edit src/, never them. The
build refuses to overwrite an index.html that was changed by hand since it
last wrote it (.build-stamp), so an edit made there can't be silently lost.

    python3 build.py            # index.html, page copies, sitemap, robots
    python3 build.py --cards    # the same, plus preview cards
    python3 build.py --check    # exit 1 if index.html doesn't match src/
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
INCLUDE = re.compile(r"^<!-- @include (\S+) -->$")

# path: (name on the card, card subtitle). Page titles and descriptions live
# in src/page-meta.json, which the app also reads for its own titles.
CARDS = {
    "drawdown": ("Drawdown Simulator",
        "Will your money last? Test withdrawal strategies against every retirement since 1926."),
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


# ---------------------------------------------------------------- assembly
def assemble():
    """src/page.html with every @include line replaced by its files."""
    out = []
    with open(os.path.join(SRC, "page.html"), encoding="utf-8") as f:
        for ln in f:
            m = INCLUDE.match(ln.rstrip("\n"))
            if not m:
                out.append(ln)
                continue
            files = sorted(glob.glob(os.path.join(SRC, m.group(1))))
            if not files:
                sys.exit("build.py: @include %s matched no files" % m.group(1))
            for p in files:
                text = open(p, encoding="utf-8").read()
                if not text.endswith("\n"):
                    text += "\n"
                out.append(text)
    return "".join(out)


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


def build_index():
    """The finished home page, exactly as it should be on disk."""
    page = assemble()
    return with_head(page, "home", meta_of(page)["home"], "home")


def copy_for(index, slug, meta):
    """The page at /slug: its own head, and its article showing without script."""
    out = with_head(index, slug, meta, slug)
    tag = re.search(r'<article class="seo-a[^"]*" data-page="%s" hidden>' % re.escape(slug), out)
    if not tag:
        return out  # /about is the About screen itself, with no article
    return out.replace(tag.group(0), tag.group(0).replace(" hidden>", ">"), 1)


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
    index = build_index()

    if "--check" in args:
        current = open(INDEX, encoding="utf-8").read()
        if current != index:
            sys.exit("build.py --check: index.html doesn't match src/. Run python3 build.py.")
        print("index.html matches src/")
        return

    if os.path.exists(INDEX) and os.path.exists(STAMP) and "--force" not in args:
        current = open(INDEX, encoding="utf-8").read()
        if sha(current) != open(STAMP).read().strip() and current != index:
            sys.exit("build.py: index.html was edited directly since the last build, and the build would\n"
                     "overwrite that edit. Make the change in src/ instead, or run with --force to discard it.")
    write_if_changed(INDEX, index)
    with open(STAMP, "w") as f:
        f.write(sha(index) + "\n")

    meta = meta_of(index)
    n = 0
    for slug, m in meta.items():
        if slug == "home":
            continue
        write_if_changed(os.path.join(ROOT, slug + ".html"), copy_for(index, slug, m))
        n += 1
    for old, slug in ALIASES.items():
        write_if_changed(os.path.join(ROOT, old + ".html"), copy_for(index, slug, meta[slug]))
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
    print("built index.html and %d page copies, sitemap.xml, robots.txt" % n)


if __name__ == "__main__":
    main()
