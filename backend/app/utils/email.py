import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime
from dotenv import load_dotenv

def get_smtp_config():
    # Force reload .env to catch any recent changes
    load_dotenv(override=True)

    config = {
        "HOST": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "PORT": int(os.getenv("SMTP_PORT", 587)),
        "USER": os.getenv("SMTP_USER"),
        "PASS": os.getenv("SMTP_PASS")
    }

    # Bug 6.2 - If .env credentials are missing, try loading from DB settings
    if not config["USER"] or not config["PASS"]:
        try:
            import pymongo
            mongo_url = os.getenv("MONGODB_URL")
            db_name = os.getenv("DATABASE_NAME", "civil_erp")
            if mongo_url:
                client = pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
                db = client[db_name]
                smtp_settings = db.settings.find_one({"type": "smtp_config"})
                if smtp_settings:
                    config["HOST"] = smtp_settings.get("host", config["HOST"])
                    config["PORT"] = int(smtp_settings.get("port", config["PORT"]))
                    config["USER"] = smtp_settings.get("username") or config["USER"]
                    config["PASS"] = smtp_settings.get("password") or config["PASS"]
                client.close()
        except Exception as e:
            pass

    return config

def send_email(to_email: str, subject: str, body: str, is_html: bool = False):
    config = get_smtp_config()
    
    if not config["USER"] or not config["PASS"]:
        print("CRITICAL: SMTP credentials (USER/PASS) not configured in .env")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = config["USER"]
        msg['To'] = to_email
        msg['Subject'] = subject
        
        content_type = "html" if is_html else "plain"
        msg.attach(MIMEText(body, content_type))
        
        # Determine if we should use SSL or TLS based on port
        if config["PORT"] == 465:
            server = smtplib.SMTP_SSL(config["HOST"], config["PORT"], timeout=15)
        else:
            server = smtplib.SMTP(config["HOST"], config["PORT"], timeout=15)
            server.starttls()
            
        server.login(config["USER"], config["PASS"])
        server.send_message(msg)
        server.quit()
        
        print(f"SUCCESS: Email sent to {to_email}")
        return True
    except Exception as e:
        return False

def generate_po_html(po_data: dict, vendor_data: dict):
    items_html = ""
    for item in po_data.get('items', []):
        site_breakdown = ""
        if item.get('site_quantities'):
            site_breakdown = '<div style="font-size: 11px; color: #666; margin-top: 4px; padding-left: 8px; border-left: 2px solid #ccc;">'
            for site, qty in item['site_quantities'].items():
                site_breakdown += f"{site}: {qty} {item['unit']}<br/>"
            site_breakdown += '</div>'
            
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>{item['name']}</strong>{site_breakdown}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item['qty']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item['unit']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹{item.get('rate', 0):,.2f}</td>
        </tr>
        """

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2F5D8A; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Purchase Order</h1>
        </div>
        <div style="padding: 24px;">
            <p>Dear <strong>{vendor_data.get('name', po_data['vendor_name'])}</strong>,</p>
            <p>Please find the purchase order details for the project <strong>{po_data['project_name']}</strong>.</p>
            
            <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>PO ID:</strong> PO-{po_data['id'][-6:].upper()}</p>
                <p style="margin: 0 0 8px 0;"><strong>Date:</strong> {datetime.now().strftime('%d %b %Y')}</p>
                <p style="margin: 0;"><strong>Expected Delivery:</strong> {po_data['expected_delivery']}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Unit</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>

            <div style="text-align: right; margin-top: 20px;">
                <h3 style="margin: 0;">Total Amount: ₹{po_data.get('total_amount', 0):,.2f}</h3>
            </div>

            {f'<div style="margin-top: 20px; padding: 12px; border-left: 4px solid #2F5D8A; background-color: #f0f7ff;"><strong>Notes:</strong><br>{po_data["notes"]}</div>' if po_data.get("notes") else ""}

            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                This is a system-generated purchase order. Please contact our procurement team for any queries.
            </p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #eee;">
            © {datetime.now().year} Civil ERP Construction Management
        </div>
    </div>
    """
    return html
