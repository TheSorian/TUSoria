import urllib.request
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://soria.avanzagrupo.com/api/paradas/1/tiempos')
with urllib.request.urlopen(req, context=ctx) as response:
    data = json.loads(response.read().decode())
    raw = json.loads(data['jsontraffics2'])
    for b in raw:
        print(f"{b.get('idBusSAE')} | {b.get('desBusLine')} | {b.get('minutesRemaining')}")
