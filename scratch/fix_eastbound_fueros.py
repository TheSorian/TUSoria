import re
import codecs

with codecs.open('src/data/soriaLinesData.js', 'r', encoding='utf-8') as f:
    data = f.read()

# Fix 4: Insert intermediate point in Fueros de Soria for Eastbound L1 pass
# Original: ['41.76257', '-2.469786'], ['41.762501', '-2.468644']
# New: ['41.76257', '-2.469786'], ['41.762550', '-2.469500'], ['41.762501', '-2.468644']
# We need to do this for all sub-polylines in L1 that have this exact segment.
pattern = r'\[\s*"41\.76257"\s*,\s*"-2\.469786"\s*\]\s*,\s*\[\s*"41\.762501"\s*,\s*"-2\.468644"\s*\]'
replacement = '["41.76257", "-2.469786"], ["41.762550", "-2.469500"], ["41.762501", "-2.468644"]'

data, count = re.subn(pattern, replacement, data)
print(f"Fixed {count} instances of Eastbound Fueros de Soria segment.")

with codecs.open('src/data/soriaLinesData.js', 'w', encoding='utf-8') as f:
    f.write(data)
