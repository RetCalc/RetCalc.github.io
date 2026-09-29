#!/usr/bin/env python3
"""Every clean URL as a real page, plus its link-preview card.

The site is one page (index.html). GitHub Pages serves drawdown.html for
/drawdown, so this writes a full copy of index.html at each address, each
with its own <head>: title, description, canonical URL, preview tags and
structured data, all read from the pageMeta JSON block in index.html (the
same table the app uses for its titles). Each copy also shows that page's
"about this tool" article without waiting for script, so what a search
engine reads is there in the HTML. The app routes by location.pathname, so
a copy opens straight on its tool, no redirect.

It also refreshes index.html's own head from the table, writes sitemap.xml
and robots.txt, and renders each route's 1200x630 card from og/template.html
with headless Chrome.

The copies are generated: edit index.html, never drawdown.html and friends.
A pre-commit hook (.git/hooks/pre-commit) re-runs this with --pages whenever
index.html is committed, so the copies can't go stale.

Run from the repo root:
    python3 og/build.py            # pages and cards
    python3 og/build.py --pages    # pages only, cards left as they are
"""
import html, json, os, re, subprocess, sys, tempfile, time, urllib.parse

SITE = "https://retcalc.app"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# path: (name on the card, card subtitle). Titles and descriptions for the
# pages themselves live in index.html's pageMeta block.
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
# Pages that keep the site's own card.
PLAIN = {"home", "about"}


def render(root, path, name, sub):
    """Render one card to og/<path>.jpg. Chrome's headless screenshot can hang
    after writing, so it's given a fixed window and then stopped."""
    png = os.path.join(tempfile.gettempdir(), "retcalc-og-%s.png" % path)
    if os.path.exists(png):
        os.remove(png)
    q = urllib.parse.urlencode({"h": name, "p": sub})
    p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--virtual-time-budget=4000", "--window-size=1200,630", "--screenshot=" + png,
        "file://" + os.path.join(root, "og", "template.html") + "?" + q],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        if os.path.exists(png) and os.path.getsize(png) > 0:
            time.sleep(0.5)
            break
        time.sleep(0.5)
    p.kill()
    if not os.path.exists(png):
        sys.exit("no card rendered for " + path)
    # JPEG keeps each card near 100 KB instead of ~400 KB as PNG.
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "85", png,
        "--out", os.path.join(root, "og", path + ".jpg")], check=True, stdout=subprocess.DEVNULL)


def url_for(slug):
    return SITE + "/" if slug == "home" else SITE + "/" + slug


def faq(src, slug):
    """The article's questions, for FAQPage structured data."""
    m = re.search(r'<article class="seo-a" data-page="%s"[^>]*>(.*?)</article>' % re.escape(slug), src, re.S)
    if not m:
        return []
    out = []
    for q, a in re.findall(r"<details><summary>(.*?)</summary><p>(.*?)</p></details>", m.group(1), re.S):
        text = lambda t: html.unescape(re.sub(r"<[^>]+>", "", t)).strip()
        out.append({"@type": "Question", "name": text(q),
                    "acceptedAnswer": {"@type": "Answer", "text": text(a)}})
    return out


def head(src, slug, meta, canon_slug):
    title, desc = meta["title"], meta["desc"]
    card = SITE + "/og.png" if slug in PLAIN else SITE + "/og/" + slug + ".jpg"
    alt = "RetCalc: know your number." if slug in PLAIN else CARDS[slug][0] + ": " + CARDS[slug][1]
    url = url_for(canon_slug)
    graph = [{"@type": "WebApplication", "name": title.split(" | ")[0], "url": url,
              "description": desc, "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}]
    q = faq(src, slug)
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


def page(src, slug, meta, canon_slug):
    out = re.sub(r"<!--PAGE-HEAD-->.*?<!--/PAGE-HEAD-->", lambda m: head(src, slug, meta, canon_slug),
                 src, count=1, flags=re.S)
    if slug != "home":
        out = out.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n<!-- Generated from index.html by og/build.py: edit index.html, not this file. -->\n', 1)
    # Show this page's article in the HTML itself, not only once script runs.
    out = out.replace('<article class="seo-a" data-page="%s" hidden>' % slug,
                      '<article class="seo-a" data-page="%s">' % slug, 1)
    return out


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cards = "--pages" not in sys.argv
    index = os.path.join(root, "index.html")
    src = open(index, encoding="utf-8").read()
    meta = json.loads(re.search(r'<script type="application/json" id="pageMeta">(.*?)</script>', src, re.S).group(1))["pages"]

    # index.html is the home page: refresh its head in place (its article is
    # un-hidden by the app, so the source stays the shared template).
    home = re.sub(r"<!--PAGE-HEAD-->.*?<!--/PAGE-HEAD-->", lambda m: head(src, "home", meta["home"], "home"),
                  src, count=1, flags=re.S)
    if home != src:
        open(index, "w", encoding="utf-8").write(home)
        src = home

    n = 0
    for slug, m in meta.items():
        if slug == "home":
            continue
        if cards and slug not in PLAIN:
            render(root, slug, *CARDS[slug])
            print("card", slug)
        open(os.path.join(root, slug + ".html"), "w", encoding="utf-8").write(page(src, slug, m, slug))
        n += 1
    for old, slug in ALIASES.items():
        open(os.path.join(root, old + ".html"), "w", encoding="utf-8").write(page(src, slug, meta[slug], slug))
        n += 1

    with open(os.path.join(root, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for slug in meta:
            f.write("  <url><loc>%s</loc></url>\n" % url_for(slug))
        f.write("</urlset>\n")
    with open(os.path.join(root, "robots.txt"), "w") as f:
        f.write("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE)
    print("pages", n, "+ index, sitemap.xml, robots.txt")


if __name__ == "__main__":
    main()
