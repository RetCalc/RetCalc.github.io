"""Renders each page of a PDF to PNG. Usage: pdf2png.py <pdf> <outdir> [scale]"""
import sys, os, pypdfium2 as pdfium
pdf, out = sys.argv[1], sys.argv[2]; scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.startswith('s') and f.endswith('.png'): os.remove(os.path.join(out, f))
doc = pdfium.PdfDocument(pdf)
for i, page in enumerate(doc):
    page.render(scale=scale).to_pil().save(os.path.join(out, f's{i+1:02d}.png'))
print(len(doc), 'pages')
