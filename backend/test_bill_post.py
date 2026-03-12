import requests
import json

url = "http://localhost:8000/finance/bills"
payload = {
    "project": "Lakshmi Developers Pvt Ltd",
    "bill_no": "RA-TEST-999",
    "date": "2026-02-24",
    "description": "Test Bill",
    "amount": 100000.0,
    "gst_rate": 18.0,
    "bill_type": "Running"
}

try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
