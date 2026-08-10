from androguard.misc import AnalyzeAPK

a, d, dx = AnalyzeAPK(r'scratch\apk_extract\com.geoactio.urbanosoria.apk')

for cls in dx.get_classes():
    if 'ParadasREST' in cls.name or 'TiemposLlegada' in cls.name or 'Config' in cls.name or 'Api' in cls.name:
        for m in cls.get_methods():
            code = m.get_method().get_code()
            if code:
                try:
                    for inst in code.get_instructions():
                        if inst.get_name() == 'const-string':
                            print(f"{cls.name} -> {inst.get_output()}")
                except:
                    pass
