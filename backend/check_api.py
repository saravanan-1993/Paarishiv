import urllib.request, json
try:
    req = urllib.request.Request('http://127.0.0.1:8000/workflow/69a670c132d31bc63bbd108f8/timeline')
    response = urllib.request.urlopen(req)
    print("Timeline Response Code:", response.getcode())
    data = json.loads(response.read().decode())
    print("Timeline count:", len(data))
except Exception as e:
    print("Error:", e)
