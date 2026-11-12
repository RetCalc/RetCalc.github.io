"""Deletes screenshots in shots/crops (and the same names in shots/crops-dark) that no build
uses, so only those are committed. The builds name each crop once; the dark set mirrors the
light one. Usage (from tooling/): .venv/bin/python prune.py [--dry-run]"""
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
paths = ['build/build.mjs', 'build/build-pages.html', 'deck/build-deck.mjs', 'deck/assets.mjs']
paths += [os.path.join('build', f) for f in os.listdir(os.path.join(root, 'build')) if f.endswith('.mjs') and f != 'build.mjs']
paths += [os.path.join('deck', f) for f in os.listdir(os.path.join(root, 'deck')) if f.endswith('.mjs') and f not in ('build-deck.mjs', 'assets.mjs')]
src = ''.join(open(os.path.join(root, p)).read() for p in paths if os.path.exists(os.path.join(root, p)))
dry = '--dry-run' in sys.argv
for d in ['crops', 'crops-dark']:
    crops = os.path.join(root, 'shots', d)
    if not os.path.isdir(crops):
        continue
    gone = []
    for f in sorted(os.listdir(crops)):
        c = f[:-4]
        if f.endswith('.png') and not (("'" + c + "'" in src) or ('/' + c + '.png' in src) or ('"' + c + '"' in src) or c.startswith('report_p')):
            gone.append(f)
            if not dry:
                os.remove(os.path.join(crops, f))
    print(d + ':', ('would remove' if dry else 'removed'), len(gone), 'unused screenshots;', len(os.listdir(crops)) - (0 if not dry else 0), 'there now')
