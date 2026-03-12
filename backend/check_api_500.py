import urllib.request
try:
    req = urllib.request.Request('http://127.0.0.1:8000/workflow/69a670c132d31bc63bbd108f8/timeline')
    response = urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print("Body:", e.read().decode())
