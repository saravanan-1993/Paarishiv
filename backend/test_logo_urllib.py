import urllib.request
import urllib.error

url = "http://localhost:8000/static/uploads/company_logo_1773663500.png"
try:
    with urllib.request.urlopen(url) as response:
        print(f"URL: {url}")
        print(f"Status Code: {response.getcode()}")
        print(f"Content Type: {response.info().get_content_type()}")
        content = response.read()
        print(f"Content Length: {len(content)}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code} {e.reason}")
except urllib.error.URLError as e:
    print(f"URL Error: {e.reason}")
except Exception as e:
    print(f"Error: {e}")
