import requests

try:
    url = "http://localhost:8000/static/uploads/company_logo_1773663500.png"
    response = requests.get(url)
    print(f"URL: {url}")
    print(f"Status Code: {response.status_code}")
    print(f"Content Type: {response.headers.get('Content-Type')}")
    print(f"Content Length: {len(response.content)}")
except Exception as e:
    print(f"Error: {e}")
