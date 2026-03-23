import urllib.request, json, urllib.error

def test_projects():
    try:
        req = urllib.request.Request('http://127.0.0.1:8000/projects/', method='GET')
        # We don't have a token here, but the server should return 401 if it's up and requires auth.
        # If it hangs, then it's a backend issue.
        resp = urllib.request.urlopen(req, timeout=5)
        print("Response Code:", resp.getcode())
    except urllib.error.HTTPError as e:
        print("Error Code:", e.code)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_projects()
