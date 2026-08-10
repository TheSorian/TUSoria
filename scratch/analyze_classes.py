from androguard.misc import AnalyzeAPK

a, d, dx = AnalyzeAPK(r'scratch\apk_extract\com.geoactio.urbanosoria.apk')
for cls in dx.get_classes():
    if 'ParadasREST' in cls.name or 'TiemposLlegada' in cls.name:
        print(f"--- CLASS: {cls.name} ---")
        for m in cls.get_methods():
            print(f"Method: {m.name}")
            try:
                for inst in m.get_method().get_instructions():
                    print(f"  {inst.get_name()} {inst.get_output()}")
            except:
                pass
