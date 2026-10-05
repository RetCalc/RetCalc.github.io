#!/usr/bin/env python3
"""Convert a piece of the current site's HTML (src/page.html, src/main/*.html)
into JSX, so markup moves into React components exactly as it was instead of
being retyped. Used during the migration (MIGRATION.md); the output is a
starting point that gets wired up by hand.

    python3 web/scripts/html2jsx.py src/main/16-tool-picker.html > out.tsx
    python3 web/scripts/html2jsx.py --lines 120-180 src/page.html

What it changes, and nothing else:
  - attribute names React spells differently (class -> className, for ->
    htmlFor, tabindex -> tabIndex, stroke-width -> strokeWidth, ...)
  - style="a:b" -> style={{a: "b"}}
  - value/checked on inputs and selected on options -> React's defaultValue /
    defaultChecked, so the fields stay editable
  - void tags (<input>, <br>, ...) closed; comments -> {/* */}
  - whitespace JSX would drop between inline elements kept as {" "}, so text
    runs the same as in the browser today
"""
import re, sys

RENAME = {
    "class": "className", "for": "htmlFor", "tabindex": "tabIndex", "readonly": "readOnly",
    "maxlength": "maxLength", "minlength": "minLength", "inputmode": "inputMode",
    "autocomplete": "autoComplete", "autofocus": "autoFocus", "colspan": "colSpan",
    "rowspan": "rowSpan", "crossorigin": "crossOrigin", "enterkeyhint": "enterKeyHint",
    "spellcheck": "spellCheck", "contenteditable": "contentEditable", "novalidate": "noValidate",
    "datetime": "dateTime", "srcset": "srcSet", "charset": "charSet", "accesskey": "accessKey",
    "xlink:href": "xlinkHref", "xml:space": "xmlSpace", "xmlns:xlink": "xmlnsXlink",
    "frameborder": "frameBorder", "allowfullscreen": "allowFullScreen",
}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
INLINE = {"a", "abbr", "b", "bdi", "button", "cite", "code", "data", "dfn", "em", "i", "img", "input",
          "kbd", "label", "mark", "q", "s", "samp", "select", "small", "span", "strong", "sub", "sup",
          "svg", "time", "u", "var", "output", "textarea", "br"}

TOKEN = re.compile(r"""<!--(?P<comment>.*?)-->
                     |<(?P<close>/)?(?P<tag>[a-zA-Z][\w:-]*)(?P<attrs>(?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(?P<selfclose>/)?>""",
                   re.S | re.X)
ATTR = re.compile(r"""([^\s=>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?""")


def camel(name):
    return re.sub(r"-([a-z])", lambda m: m.group(1).upper(), name)


def style_obj(css):
    parts, custom = [], False
    for decl in css.split(";"):
        if ":" not in decl:
            continue
        k, v = decl.split(":", 1)
        k, v = k.strip(), v.strip()
        if k.startswith("--"):
            custom = True
            key = '"%s"' % k
        elif k.startswith("-"):  # -webkit-mask -> WebkitMask
            key = camel(k[1:])[0].upper() + camel(k[1:])[1:]
        else:
            key = camel(k)
        parts.append('%s: "%s"' % (key, v.replace('"', '\\"')))
    body = "{" + ", ".join(parts) + "}"
    return "{%s as React.CSSProperties}" % body if custom else "{%s}" % body


def jsx_value(v):
    if '"' not in v:
        return '"%s"' % v
    return "{%s}" % repr(v)


def convert_attrs(tag, raw):
    out, selected, value = [], False, None
    for m in ATTR.finditer(raw):
        name, val = m.group(1), m.group(2)
        if val is not None and val[0] in "\"'":
            val = val[1:-1]
        low = name.lower()
        if low.startswith("on"):
            sys.exit("html2jsx: inline handler %s on <%s>; wire it up in React instead" % (name, tag))
        if low == "style" and val is not None:
            out.append("style=" + style_obj(val))
            continue
        if tag == "option" and low == "selected":
            selected = True
            continue
        if tag == "option" and low == "value":
            value = val
        if tag in ("input", "textarea") and low == "value":
            name = "defaultValue"
        elif tag == "input" and low == "checked":
            name = "defaultChecked"
        elif low in RENAME:
            name = RENAME[low]
        elif "-" in name and not low.startswith(("data-", "aria-")):
            name = camel(name)
        if val is None:
            out.append('%s=""' % name if low.startswith("data-") else name)
        else:
            out.append("%s=%s" % (name, jsx_value(val)))
    return out, selected, value


def convert(src):
    out, last_tag, selects = [], None, []
    pos = 0
    tokens = list(TOKEN.finditer(src))

    def text(t, prev_tag, next_tag):
        if not t:
            return ""
        t = t.replace("{", "\x00").replace("}", "\x01")
        # Characters React's lint rule wants spelled as entities in text.
        t = t.replace("'", "&apos;").replace('"', "&quot;").replace(">", "&gt;")
        t = t.replace("\x00", '{"{"}').replace("\x01", '{"}"}')
        if not t.strip():
            if "\n" in t and prev_tag in INLINE and next_tag in INLINE:
                return '{" "}' + t
            return t
        lead = re.match(r"\s*", t).group(0)
        trail = re.search(r"\s*$", t).group(0)
        core = t[len(lead):len(t) - len(trail)]
        if "\n" in lead and prev_tag in INLINE:
            lead = '{" "}' + lead
        if "\n" in trail and next_tag in INLINE:
            trail = '{" "}' + trail
        return lead + core + trail

    for i, m in enumerate(tokens):
        nxt = m.group("tag").lower() if m.group("tag") else None
        out.append(text(src[pos:m.start()], last_tag, nxt))
        pos = m.end()
        if m.group("comment") is not None:
            out.append("{/*%s*/}" % m.group("comment").replace("*/", "* /"))
            continue
        tag = m.group("tag")
        low = tag.lower()
        if m.group("close"):
            if low == "select" and selects:
                idx, chosen = selects.pop()
                if chosen is not None:
                    out[idx] = out[idx][:-1] + ' defaultValue="%s">' % chosen
            out.append("</%s>" % tag)
        else:
            attrs, selected, value = convert_attrs(low, m.group("attrs") or "")
            if low == "option" and selected and selects:
                selects[-1][1] = value
            close = " />" if (low in VOID or m.group("selfclose")) else ">"
            out.append("<%s%s%s" % (tag, "".join(" " + a for a in attrs), close))
            if low == "select" and close == ">":
                selects.append([len(out) - 1, None])
        last_tag = low
    out.append(text(src[pos:], last_tag, None))
    return "".join(out)


def main():
    args = sys.argv[1:]
    lines = None
    if args and args[0] == "--lines":
        a, b = args[1].split("-")
        lines = (int(a), int(b))
        args = args[2:]
    src = open(args[0], encoding="utf-8").read()
    if lines:
        src = "".join(src.splitlines(True)[lines[0] - 1:lines[1]])
    sys.stdout.write(convert(src))


if __name__ == "__main__":
    main()
