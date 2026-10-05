#!/usr/bin/env python3
"""Shows where an old-vs-new check's text differs. When a case's numbers
don't match, e2e/compare.ts saves both snapshots beside the test's results
(<case>-old.json and <case>-new.json); this prints each field that differs,
and for long text just the stretch around each difference.

    python3 web/scripts/snapshot-diff.py web/test-results/<test folder>
"""
import json,glob,difflib,sys
D=sys.argv[1]
for old in glob.glob(D+'/*-old.json'):
    a=json.load(open(old)); b=json.load(open(old.replace('-old.json','-new.json')))
    print('##', old.split('/')[-1])
    for k in sorted(set(a)|set(b)):
        if a.get(k)!=b.get(k):
            x,y=a.get(k) or '', b.get(k) or ''
            if len(x)>200 or len(y)>200:
                sm=difflib.SequenceMatcher(None,x,y,autojunk=False)
                for op,i1,i2,j1,j2 in sm.get_opcodes():
                    if op!='equal': print(k, op, repr(x[max(0,i1-60):i2+30]), '=>', repr(y[max(0,j1-60):j2+30]))
            else: print(k, repr(x), '=>', repr(y))
