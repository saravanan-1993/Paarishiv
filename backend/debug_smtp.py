import smtplib
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv

# Path to .env
env_path = os.path.join(os.getcwd(), '.env')
load_dotenv(env_path)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")

print(f"Testing SMTP with Host: {SMTP_HOST}, Port: {SMTP_PORT}, User: {SMTP_USER}")

def test_smtp():
    if not SMTP_USER or not SMTP_PASS:
        print("Error: SMTP credentials missing in .env")
        return
    
    try:
        print("Connecting to server...")
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
        print("Connected. Starting TLS...")
        server.starttls()
        print("TLS started. Attempting login...")
        server.login(SMTP_USER, SMTP_PASS)
        print("Login successful!")
        
        # Try sending a test email to the same address
        msg = MIMEText("This is a test email from Civil ERP debugging script.")
        msg['Subject'] = "SMTP Test Connection"
        msg['From'] = SMTP_USER
        msg['To'] = SMTP_USER
        
        print(f"Sending test email to {SMTP_USER}...")
        server.send_message(msg)
        print("Test email sent successfully!")
        server.quit()
        
    except smtplib.SMTPAuthenticationError:
        print("Error: Login failed. Authentication rejected. (Likely incorrect password or App Password needed)")
    except smtplib.SMTPConnectError:
        print("Error: Could not connect to the SMTP server. Check host and port.")
    except Exception as e:
        print(f"An unexpected error occurred: {type(e).__name__}: {e}")

if __name__ == "__main__":
    test_smtp()
