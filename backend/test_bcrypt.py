import bcrypt
try:
    password = "password"
    hashed = "$2b$12$i/eiSS/vJMzy9S/Pp.2EuuwT7lyNjoZeiHLPAJPDnHYorGqatcRV2"
    result = bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    print(f"Bcrypt check result: {result}")
except Exception as e:
    print(f"Error: {e}")
