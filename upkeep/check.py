#!/usr/bin/env python3
"""What on retcalc.app is overdue for an update, from upkeep/items.json.

    python3 upkeep/check.py            # overdue or due in the next 30 days
    python3 upkeep/check.py --all      # every item
    python3 upkeep/check.py --write    # also regenerate SCHEDULE.md and schedule.csv
    python3 upkeep/check.py --hook     # for the session-start hook: overdue or
                                       # due within 14 days, or nothing at all
    python3 upkeep/check.py --today 2027-01-05   # as if it were another day

Two items take their dates from the code rather than items.json: today's
CAPE (CAPE_NOW_ASOF in web/lib/engine/data/history.js) and the article reviews
(each article's data-reviewed date). See upkeep/UPKEEP.md.
"""
import csv, datetime as dt, glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SOON, HOOK_SOON = 30, 14
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]


def day(s):
    return dt.date.fromisoformat(s)


def derive(item):
    """Fill in the dates of the items that read them from the code."""
    if item.get("derive") == "cape":
        src = open(os.path.join(ROOT, "web", "lib", "engine", "data", "history.js"), encoding="utf-8").read()
        m = re.search(r'CAPE_NOW\s*=\s*([\d.]+),\s*CAPE_NOW_ASOF\s*=\s*"(\d{1,2}) (\w+) (\d{4})"', src)
        if m:
            asof = dt.date(int(m.group(4)), MONTHS.index(m.group(3)) + 1, int(m.group(2)))
            item["last_updated"] = asof.isoformat()
            item["next_due"] = (asof + dt.timedelta(days=item.get("max_age_days", 36))).isoformat()
            item["data_for"] = "%s, the %s reading" % (m.group(1), asof.strftime("%-d %B %Y"))
    elif item.get("derive") in ("articles", "lessons"):
        dates = {}
        for p in glob.glob(os.path.join(ROOT, "web", "content", item["derive"], "*.html")):
            m = re.search(r'<article[^>]*data-reviewed="(\d{4}-\d\d-\d\d)"', open(p, encoding="utf-8").read())
            if m:
                dates[os.path.basename(p)[:-5]] = m.group(1)
        if dates:
            oldest = min(dates.values())
            age = item.get("max_age_days", 90)
            item["last_updated"] = oldest
            item["next_due"] = (day(oldest) + dt.timedelta(days=age)).isoformat()
            stale = sorted(k for k, v in dates.items() if v == oldest)
            item["data_for"] = "%d %s; oldest review %s (%s)" % (
                len(dates), item["derive"], oldest, ", ".join(stale) if len(stale) <= 3 else "%d of them" % len(stale))
    return item


def status(item, today):
    left = (day(item["next_due"]) - today).days
    if left < 0:
        return "Overdue", left
    if left <= SOON:
        return "Due soon", left
    return "OK", left


def when(left):
    if left < 0:
        return "%d days overdue" % -left
    if left == 0:
        return "due today"
    return "due in %d days" % left


def load(today):
    items = json.load(open(os.path.join(HERE, "items.json"), encoding="utf-8"))["items"]
    out = []
    for it in items:
        derive(it)
        it["status"], it["left"] = status(it, today)
        out.append(it)
    return sorted(out, key=lambda it: (it["next_due"], it["name"]))


def write(items, today):
    mark = {"Overdue": "🔴 Overdue", "Due soon": "🟡 Due soon", "OK": "🟢 OK"}
    n = {s: sum(1 for it in items if it["status"] == s) for s in mark}
    lines = [
        "# RetCalc upkeep schedule",
        "",
        "Generated from `upkeep/items.json` by `python3 upkeep/check.py --write` on %s; "
        "don't edit by hand. Status is as of that day: the **Next due** column is what counts. "
        "Ask Claude to refresh it, or to update anything that's due." % today.isoformat(),
        "",
        "**%d overdue · %d due within %d days · %d up to date**" % (n["Overdue"], n["Due soon"], SOON, n["OK"]),
        "",
        "| Status | Item | Area | Now covers | Last updated | Next due | How often | Source |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    esc = lambda s: str(s).replace("|", "\\|")
    for it in items:
        lines.append("| %s | **%s** | %s | %s | %s | %s | %s | %s |" % tuple(esc(x) for x in (
            mark[it["status"]], it["name"], it["area"], it.get("data_for", ""), it["last_updated"],
            it["next_due"], it["cadence"], it["source"])))
    lines += ["", "## What each item covers", ""]
    for it in items:
        lines.append("- **%s.** %s" % (it["name"], it["what"]))
    open(os.path.join(HERE, "SCHEDULE.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

    with open(os.path.join(HERE, "schedule.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Status", "Item", "Area", "Priority", "Now covers", "Last updated", "Next due",
                    "How often", "Source", "What it is", "Where in the code"])
        for it in items:
            w.writerow([it["status"], it["name"], it["area"], it.get("priority", ""), it.get("data_for", ""),
                        it["last_updated"], it["next_due"], it["cadence"], it["source"], it["what"],
                        "; ".join(it["where"])])


def main(argv):
    today = dt.date.today()
    if "--today" in argv:
        today = day(argv[argv.index("--today") + 1])
    items = load(today)

    if "--hook" in argv:
        due = [it for it in items if it["left"] <= HOOK_SOON]
        if due:
            print("RetCalc upkeep (upkeep/items.json): these figures are overdue or due within %d days. "
                  "Mention them to the owner once this session, briefly, and ask before updating any; "
                  "upkeep/UPKEEP.md says how." % HOOK_SOON)
            for it in due:
                print("- %s: %s (next due %s; now covers: %s)" % (
                    it["name"], when(it["left"]), it["next_due"], it.get("data_for") or "n/a"))
        return 0

    shown = items if "--all" in argv else [it for it in items if it["status"] != "OK"]
    print("RetCalc upkeep, %s: %d overdue, %d due within %d days, %d up to date" % (
        today.isoformat(), sum(it["status"] == "Overdue" for it in items),
        sum(it["status"] == "Due soon" for it in items), SOON, sum(it["status"] == "OK" for it in items)))
    for it in shown:
        print("  %-9s %-52s %-17s next due %s" % (it["status"], it["name"][:52], when(it["left"]), it["next_due"]))
    if "--write" in argv:
        write(items, today)
        print("Wrote upkeep/SCHEDULE.md and upkeep/schedule.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
