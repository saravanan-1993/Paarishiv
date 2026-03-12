import requests

base_url = "http://localhost:8000"

# Login as accountant
res = requests.post(f"{base_url}/auth/login", data={"username": "accountant", "password": "password"})
if res.status_code == 200:
    token = res.json().get("access_token")
    print(f"Logged in successfully. Token: {token[:10]}...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try getting bills
    bills_res = requests.get(f"{base_url}/finance/bills", headers=headers)
    print(f"/finance/bills status: {bills_res.status_code}")
    print(bills_res.text[:100])

    # Try getting payables
    payables_res = requests.get(f"{base_url}/finance/payables", headers=headers)
    print(f"/finance/payables status: {payables_res.status_code}")
    
    # Try getting expenses
    exp_res = requests.get(f"{base_url}/finance/expenses", headers=headers)
    print(f"/finance/expenses status: {exp_res.status_code}")
else:
    print(f"Login failed: {res.status_code} {res.text}")
