import http.client
import json

def test_create_bill():
    conn = http.client.HTTPConnection("localhost", 8000)
    payload = {
        "project": "Metro Project",
        "bill_no": "TEST-202",
        "amount": 1000,
        "gst_rate": 18,
        "bill_type": "Running",
        "description": "Test bill"
    }
    headers = {'Content-Type': 'application/json'}
    conn.request("POST", "/finance/bills", json.dumps(payload), headers)
    res = conn.getresponse()
    print(f"Status: {res.status}")
    print(f"Response: {res.read().decode()}")

if __name__ == "__main__":
    test_create_bill()
