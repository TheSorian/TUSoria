import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://sirigmv.avanzagrupo.com/Siriv2/SiriWS.asmx'
headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': 'http://tempuri.org/GetStopMonitoring'
}
data = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetStopMonitoring xmlns="http://tempuri.org/">
      <Request>
        <RequestTimestamp>2026-08-10T18:25:00Z</RequestTimestamp>
        <MessageIdentifier>1</MessageIdentifier>
        <PreviewInterval>PT60M</PreviewInterval>
        <MonitoringRef>21</MonitoringRef>
      </Request>
    </GetStopMonitoring>
  </soap:Body>
</soap:Envelope>"""

req = urllib.request.Request(url, data=data.encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req, context=ctx) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print('Error:', e)
