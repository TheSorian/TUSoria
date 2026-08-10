from androguard.misc import AnalyzeAPK

print("Starting AnalyzeAPK...")
a, d, dx = AnalyzeAPK(r'scratch\apk_extract\com.geoactio.urbanosoria.apk')
print("APK analyzed. Searching for classes...")

target_classes = ['Lcom/geoactio/urbanosoria/ws/ParadasREST;', 'Lcom/geoactio/urbanosoria/ws/ParadasCercanasSOAP;']

for cls in dx.get_classes():
    if any(t in cls.name for t in target_classes):
        print(f"\n--- CLASS: {cls.name} ---")
        for m in cls.get_methods():
            print(f"Method: {m.name}")
            code = m.get_method().get_code()
            if code:
                try:
                    for inst in code.get_instructions():
                        if inst.get_name() == 'const-string':
                            print(f"  STR: {inst.get_output()}")
                except Exception as e:
                    pass
print("Done.")
