#!/usr/bin/env python3
"""Link-preview pages and cards for every clean URL.

The site is one page, and GitHub Pages only reaches /drawdown and friends
through 404.html, which answers with a 404 and no preview tags, so texting
one of those links showed a bare address. This writes a small drawdown.html
(GitHub Pages serves it for /drawdown) for each route: its own title,
description and og:image for whatever fetches the preview, then the same
hop into the app that 404.html makes for people. It also renders each
route's 1200x630 card from og/template.html with headless Chrome.

Run from the repo root after adding a tool or renaming one:
    python3 og/build.py            # pages and cards
    python3 og/build.py --pages    # pages only, cards left as they are
"""
import html, os, subprocess, sys, tempfile, time, urllib.parse

SITE = "https://retcalc.app"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# path: (name on the card, card subtitle, meta description)
PAGES = {
    "drawdown": ("Drawdown Simulator",
        "Will your money last? Test withdrawal strategies against every retirement since 1926.",
        "Will your money last? Test withdrawal strategies against every retirement since 1926."),
    "bridge": ("Early Retirement Bridge",
        "Retiring before 59½? Compare a Roth ladder, 72(t), the rule of 55 and your brokerage.",
        "Retiring before 59½? Compare a Roth ladder, 72(t) payments, the rule of 55 and your brokerage, with the tax, penalties and ACA premiums each costs."),
    "backtest": ("Portfolio Backtest",
        "Pick a stock and bond mix and see what it actually did, every year back to 1926.",
        "Pick a stock and bond mix, then see what it actually did: return, volatility, the worst year, the deepest fall, and every rolling window back to 1926."),
    "incometax": ("Income Tax",
        "Your 2026 federal, state and FICA tax, on a salary or on a year of retirement withdrawals.",
        "Estimate your 2026 federal, state and FICA tax on a salary, or see what a year of retirement withdrawals costs."),
    "roth": ("Roth Conversion & RMDs",
        "Project required distributions to 100, then test a conversion schedule against doing nothing.",
        "Project required distributions to age 100, then test a Roth conversion schedule against doing nothing: lifetime tax, after-tax net worth and IRMAA."),
    "mortgage": ("Mortgage Calculator",
        "Your monthly payment, how the balance falls, and the amortization year by year.",
        "Calculate your monthly payment, see how the balance falls, and explore amortization year by year."),
    "college": ("College Savings",
        "How much to save each month to cover tuition, from state school to elite.",
        "How much to save each month to cover tuition, with presets for state school, private, and elite colleges."),
    "rentbuy": ("Rent vs. Buy",
        "Buyer and renter net worth over any horizon, down payment and home value included.",
        "Compare buyer and renter net worth over any horizon, counting what the down payment could have earned and what the home gains in value."),
    "budget": ("Budget",
        "Lay out your income and expenses, see what's left, and find out where your money goes.",
        "Lay out your income and expenses, see what's left, and find out where your money goes."),
    "debt": ("Debt Payoff",
        "List what you owe, then watch the avalanche and snowball methods race to your payoff date.",
        "List what you owe, then watch avalanche and snowball race each other: payoff date, total interest, and what ordering by motivation costs you."),
    "healthcare": ("Healthcare Cost Planner",
        "ACA premiums and subsidies before Medicare, then Part B, Part D and IRMAA by income.",
        "ACA marketplace premiums and subsidies for the gap before Medicare, then Medicare Part B, Part D, and IRMAA surcharges by income."),
    "fire": ("FIRE Calculator",
        "Find when your portfolio reaches financial independence, or when you can coast.",
        "Find when your portfolio reaches financial independence, or switch to Coast FIRE to see when you can stop contributing."),
    "advanced": ("Advanced Calculator",
        "Growth, inflation, taxes, fees and market swings, with account types and a glide path.",
        "Project your retirement savings with growth, inflation, taxes, fees and market swings, account types and a glide path."),
    "stages": ("Stages Calculator",
        "Save in stages, with different contributions, returns and mixes as life changes.",
        "Plan your retirement savings in stages, with different contributions, returns and investment mixes as life changes."),
    "guide": ("Retirement Readiness Guide",
        "One question at a time: a readiness score out of 100, a plan, and what to do next.",
        "A guided check-up, one question at a time: a retirement readiness score out of 100, a plan you can adjust, and what to do next."),
    "tools": ("Retirement Tools",
        "Drawdown, taxes, Roth conversions, healthcare, FIRE, budgets and more.",
        "Retirement and money tools: drawdown, income tax, Roth conversions, healthcare, FIRE, mortgages, budgets and more."),
}
# Old addresses that still open a tab; they share its card.
ALIASES = {"single": "advanced", "series": "stages"}
# Pages that keep the site's own card.
PLAIN = {"about": ("About", "How the Retirement Calculator works, where its numbers come from, and what each tool does.")}

STUB = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#080b16">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Retirement Calculator">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{image}">
<script>
  /* Generated by og/build.py; edit that, not this. The preview tags above
     are for whatever unfurls a link to this page. People go straight on
     into the app, the same hop 404.html makes: the path is packed into a
     "?/" query string that index.html unpacks back into the address bar,
     and the hash (a shared link's numbers) rides along untouched. */
  var l = window.location;
  l.replace(
    l.protocol + "//" + l.hostname + (l.port ? ":" + l.port : "") + "/?/" +
    l.pathname.slice(1).replace(/\\.html$/, "").replace(/&/g, "~and~") +
    (l.search ? "&" + l.search.slice(1).replace(/&/g, "~and~") : "") +
    l.hash
  );
</script>
</head>
<body><noscript><a href="/">Retirement Calculator</a></noscript></body>
</html>
"""


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


def stub(root, path, title, desc, image, alt):
    with open(os.path.join(root, path + ".html"), "w") as f:
        f.write(STUB.format(title=html.escape(title), desc=html.escape(desc),
            url=SITE + "/" + path, image=image, alt=html.escape(alt)))


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cards = "--pages" not in sys.argv
    for path, (name, sub, desc) in PAGES.items():
        if cards:
            render(root, path, name, sub)
            print("card", path)
        stub(root, path, name + " · Retirement Calculator", desc,
             SITE + "/og/" + path + ".jpg", name + ": " + sub)
    for path, target in ALIASES.items():
        name, sub, desc = PAGES[target]
        stub(root, path, name + " · Retirement Calculator", desc,
             SITE + "/og/" + target + ".jpg", name + ": " + sub)
    for path, (name, desc) in PLAIN.items():
        stub(root, path, name + " · Retirement Calculator", desc,
             SITE + "/og.png", "Retirement Calculator: know your number.")
    print("pages", len(PAGES) + len(ALIASES) + len(PLAIN))


if __name__ == "__main__":
    main()
