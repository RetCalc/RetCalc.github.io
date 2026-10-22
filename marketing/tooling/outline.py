"""Adds a bookmark sidebar to a PDF from outline.json. Usage: outline.py <pdf> <outline.json>"""
import json, sys
from pypdf import PdfReader, PdfWriter
pdf, spec = sys.argv[1], json.load(open(sys.argv[2]))
w = PdfWriter(clone_from=PdfReader(pdf))
for item in spec:
    top = w.add_outline_item(item['title'], item['page'] - 1)
    for k in item.get('kids', []):
        w.add_outline_item(k['title'], k['page'] - 1, parent=top)
w.page_mode = '/UseOutlines'
w.write(pdf)
print('outline:', len(spec), 'top-level,', sum(len(i.get('kids', [])) for i in spec), 'nested')
