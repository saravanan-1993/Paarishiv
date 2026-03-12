import urllib.request, json, urllib.error
data=json.dumps({'amount': 31122.5, 'base_amount': 26375, 'gst_amount': 4747.5, 'invoice_no': '100013', 'paymentMode': 'NEFT/RTGS', 'mark_as_paid': True, 'project': 'General'}).encode('utf-8')
req=urllib.request.Request('http://127.0.0.1:8000/finance/expenses', data=data, headers={'Content-Type': 'application/json'}, method='POST')
try:
    urllib.request.urlopen(req)
    print("Success")
except urllib.error.HTTPError as e:
    print('Error:', e.code, e.read().decode())
