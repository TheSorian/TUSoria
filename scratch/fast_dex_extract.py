import os
from androguard.core.bytecodes.dvm import DalvikVMFormat

base = r'scratch\apk_extract\unzipped'
for r, d, files in os.walk(base):
    for f in files:
        if f.endswith('.dex'):
            path = os.path.join(r, f)
            print(f"Reading {path}...")
            with open(path, 'rb') as fp:
                dex = DalvikVMFormat(fp.read())
                for cls in dex.get_classes():
                    name = cls.get_name()
                    if 'ParadasREST' in name or 'Config' in name or 'Api' in name or 'Geoactio' in name:
                        strings = []
                        for m in cls.get_methods():
                            code = m.get_code()
                            if code:
                                try:
                                    for inst in code.get_instructions():
                                        if inst.get_name() == 'const-string':
                                            strings.append(inst.get_output())
                                except:
                                    pass
                        if strings:
                            print(f"--- {name} ---")
                            for s in strings:
                                print(f"  STR: {s}")
