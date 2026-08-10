import os
import re

base_dir = r'scratch\apk_extract\unzipped'
geoactio = set()

for root, dirs, files in os.walk(base_dir):
    for name in files:
        if name.endswith('.dex'):
            path = os.path.join(root, name)
            with open(path, 'rb') as f:
                data = f.read().decode('utf-8', 'ignore')
                urls = re.findall(r'https?://[^\s"\'<>]+', data)
                for u in urls:
                    if 'geoactio' in u.lower() or 'avanza' in u.lower() or 'soria' in u.lower():
                        geoactio.add(u)

for u in sorted(list(geoactio)):
    print(u)
