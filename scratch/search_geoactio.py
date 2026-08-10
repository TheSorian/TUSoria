import os, re
base = r'scratch\apk_extract\unzipped'
res = set()
for r, d, files in os.walk(base):
    for f in files:
        if f.endswith('.dex'):
            with open(os.path.join(r, f), 'rb') as fp:
                data = fp.read().decode('utf-8', 'ignore')
                matches = re.findall(r'https?://[a-zA-Z0-9\.\-]*geoactio[^\s"\'<>]*', data)
                for m in matches:
                    res.add(m)
for m in sorted(list(res)):
    print(m)
