import urllib.request
import urllib.parse
import json

url = "http://localhost:8000/auth/login"
data = urllib.parse.urlencode({'username': 'accountant', 'password': 'password'}).encode('utf-8')
req = urllib.request.Request(url, data=data)

response = urllib.request.urlopen(req)
token_data = json.loads(response.read())
token = token_data['access_token']

print("Token:", token[:10])

# check bills
bills_req = urllib.request.Request("http://localhost:8000/finance/bills", headers={"Authorization": f"Bearer {token}"})
bills_res = urllib.request.urlopen(bills_req)
print("Bills status:", bills_res.status)
