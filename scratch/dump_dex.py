import os, re

base = r'scratch\apk_extract\unzipped'
strings_set = set()

for r, d, files in os.walk(base):
    for f in files:
        if f.endswith('.dex'):
            with open(os.path.join(r, f), 'rb') as fp:
                data = fp.read().decode('utf-8', 'ignore')
                for match in re.findall(r'[A-Za-z0-9_/\.\-\?&]{5,}', data):
                    strings_set.add(match)

with open(r'scratch\apk_strings.txt', 'w', encoding='utf-8') as f:
    for s in sorted(list(strings_set)):
        f.write(s + '\n')
