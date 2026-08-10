import re
import codecs

with codecs.open('src/data/soriaLinesData.js', 'r', encoding='utf-8') as f:
    data = f.read()

# Fix 1: Westbound return from Calaveron (Alberca to Fueros de Soria)
# Original: ['41.762276', '-2.468621'], ['41.762276', '-2.468621'], ['41.762534', '-2.469774']
# New: ['41.762276', '-2.468621'], ['41.762501', '-2.468644'], ['41.762534', '-2.469774']
pattern1 = r'\[\s*"41\.762276"\s*,\s*"-2\.468621"\s*\]\s*,\s*\[\s*"41\.762276"\s*,\s*"-2\.468621"\s*\]\s*,\s*\[\s*"41\.762534"\s*,\s*"-2\.469774"\s*\]'
replacement1 = '["41.762276", "-2.468621"], ["41.762501", "-2.468644"], ["41.762534", "-2.469774"]'

data, count1 = re.subn(pattern1, replacement1, data)
print(f"Fixed {count1} instances of westbound diagonal.")

# Fix 2: Eastbound L1[2] jump from Mariano Granados directly to Alfonso VIII and back up to Fueros de Soria
# Original: ['41.763793', '-2.469427'], ['41.762588', '-2.469774'], ['41.763439', '-2.468913'], ['41.763772', '-2.468729']
# This happens around point 155 in L1[2]
# The route should just go from Mariano Granados down Paseo del Espolon to Ramon y Cajal.
# Paseo del Espolon points: ["41.763793", "-2.469427"], ["41.763808", "-2.468693"]
pattern2 = r'\[\s*"41\.763793"\s*,\s*"-2\.469427"\s*\]\s*,\s*\[\s*"41\.762588"\s*,\s*"-2\.469774"\s*\]\s*,\s*\[\s*"41\.763439"\s*,\s*"-2\.468913"\s*\]\s*,\s*\[\s*"41\.763772"\s*,\s*"-2\.468729"\s*\]'
replacement2 = '["41.763793", "-2.469427"], ["41.763889", "-2.468728"], ["41.763808", "-2.468693"], ["41.763772", "-2.468729"]'

data, count2 = re.subn(pattern2, replacement2, data)
print(f"Fixed {count2} instances of eastbound jump from Mariano Granados.")

# Fix 3: Eastbound L1[0] jump from Mariano Granados directly to Alfonso VIII
# Original: ['41.763928', '-2.469366'], ['41.76257', '-2.469786']
# Wait, this is actually the route to Calaveron. It goes from Mariano Granados DOWN Avenida de Navarra (Alfonso VIII) to Duques de Soria!
# Point 2 is Mariano Granados, Point 3 is Alfonso VIII intersection.
# Avenida de Navarra IS the street! So this is technically fine, except it's a straight line.
# If the user complains that "una no va por la calle", they probably mean the first diagonal we fixed (Point 20 to 22), or the L1[2] jump!

with codecs.open('src/data/soriaLinesData.js', 'w', encoding='utf-8') as f:
    f.write(data)
