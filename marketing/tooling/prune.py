"""Deletes screenshots in shots/crops that no build uses, so only those are committed.
Usage (from tooling/): .venv/bin/python prune.py [--dry-run]"""
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
src = ''.join(open(os.path.join(root, p)).read() for p in ['build/build.mjs', 'build/build-pages.html', 'deck/build-deck.mjs', 'deck/assets.mjs'])
crops = os.path.join(root, 'shots', 'crops')
gone = []
for f in sorted(os.listdir(crops)):
    c = f[:-4]
    if f.endswith('.png') and not (("'" + c + "'" in src) or ('/' + c + '.png' in src) or c.startswith('report_p')):
        gone.append(f)
        if '--dry-run' not in sys.argv:
            os.remove(os.path.join(crops, f))
print(('would remove' if '--dry-run' in sys.argv else 'removed'), len(gone), 'unused screenshots;', len(os.listdir(crops)), 'left')
