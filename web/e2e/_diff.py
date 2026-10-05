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
