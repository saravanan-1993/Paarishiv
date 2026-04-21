import logging
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fastapi import (
    APIRouter, Depends, HTTPException, BackgroundTasks,
    status, Body, UploadFile, File, Form,
)
from typing import List, Optional
from database import get_database
from pydantic import BaseModel
from datetime import datetime

from app.utils.email import send_email, get_smtp_config
from app.utils.auth import get_current_user, validate_object_id
from app.utils.logging import log_activity
from app.utils.rbac import RBACPermission
from app.utils.cloudinary import upload_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quotations", tags=["quotations"])


class QuotationItem(BaseModel):
    item_name: str
    description: Optional[str] = ""
    unit: str = "Nos"
    qty: float = 0
    rate: float = 0
    amount: Optional[float] = 0


class QuotationCreate(BaseModel):
    client_name: str
    client_email: Optional[str] = ""
    client_phone: Optional[str] = ""
    client_address: Optional[str] = ""
    project_name: str
    project_address: Optional[str] = ""
    scope_of_work: Optional[str] = ""
    validity: Optional[str] = "30 days"
    items: List[QuotationItem]
    payment_schedule: Optional[str] = ""
    terms_conditions: Optional[str] = ""
    total_amount: Optional[float] = 0
    notes: Optional[str] = ""
    status: str = "Draft"


def quotation_helper(q) -> dict:
    return {
        "id": str(q["_id"]),
        "quotation_no": q.get("quotation_no", f"QT-{str(q['_id'])[-6:].upper()}"),
        "client_name": q.get("client_name", ""),
        "client_email": q.get("client_email", ""),
        "client_phone": q.get("client_phone", ""),
        "client_address": q.get("client_address", ""),
        "project_name": q.get("project_name", ""),
        "project_address": q.get("project_address", ""),
        "scope_of_work": q.get("scope_of_work", ""),
        "validity": q.get("validity", ""),
        "items": q.get("items", []),
        "payment_schedule": q.get("payment_schedule", ""),
        "terms_conditions": q.get("terms_conditions", ""),
        "total_amount": q.get("total_amount", 0),
        "notes": q.get("notes", ""),
        "status": q.get("status", "Draft"),
        "created_at": q.get("created_at"),
        "created_by": q.get("created_by", ""),
        "sent_at": q.get("sent_at"),
        "sent_to": q.get("sent_to", ""),
    }


def _nl2br(text: str) -> str:
    """Convert newlines to <br> for email-safe rendering."""
    if not text:
        return ""
    return str(text).replace("\r\n", "\n").replace("\n", "<br>")


def _info_row(label: str, value: str) -> str:
    """Render one 'Label: value' line — used inside the Company / Client blocks."""
    if value in (None, ""):
        return ""
    return (
        f'<tr><td style="padding:2px 0;color:#64748b;font-size:12px;'
        f'font-family:Arial,sans-serif;width:78px;vertical-align:top;">{label}</td>'
        f'<td style="padding:2px 0;color:#334155;font-size:13px;'
        f'font-family:Arial,sans-serif;vertical-align:top;">{value}</td></tr>'
    )


def generate_quotation_html(q: dict, company: dict) -> str:
    items_html = ""
    for i, it in enumerate(q.get("items", []), 1):
        qty = float(it.get("qty", 0) or 0)
        rate = float(it.get("rate", 0) or 0)
        amt = float(it.get("amount") or qty * rate)
        desc_line = (
            f'<div style="color:#64748b;font-size:11px;margin-top:2px;">'
            f'{it.get("description", "")}</div>'
            if it.get("description") else ""
        )
        items_html += (
            f'<tr>'
            f'<td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">{i}</td>'
            f'<td style="padding:8px;border:1px solid #e5e7eb;">'
            f'<strong>{it.get("item_name", "")}</strong>{desc_line}</td>'
            f'<td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">{it.get("unit", "")}</td>'
            f'<td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">{qty}</td>'
            f'<td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Rs. {rate:,.2f}</td>'
            f'<td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Rs. {amt:,.2f}</td>'
            f'</tr>'
        )

    company_name = company.get("companyName") or company.get("name") or "Civil ERP"
    company_addr = _nl2br(company.get("address", ""))
    company_phone = company.get("phone", "")
    company_email = company.get("email", "")
    company_gst = company.get("gst", "") or company.get("gstin", "")

    client_name = q.get("client_name", "")
    client_addr = _nl2br(q.get("client_address", ""))
    client_phone = q.get("client_phone", "")
    client_email = q.get("client_email", "")

    company_rows = (
        f'<tr><td colspan="2" style="padding-bottom:6px;color:#0f172a;'
        f'font-size:14px;font-family:Arial,sans-serif;"><strong>{company_name}</strong></td></tr>'
        + _info_row("Address", company_addr)
        + _info_row("Phone", company_phone)
        + _info_row("Email", company_email)
        + _info_row("GSTIN", company_gst)
    )

    client_rows = (
        f'<tr><td colspan="2" style="padding-bottom:6px;color:#0f172a;'
        f'font-size:14px;font-family:Arial,sans-serif;"><strong>{client_name}</strong></td></tr>'
        + _info_row("Address", client_addr)
        + _info_row("Phone", client_phone)
        + _info_row("Email", client_email)
    )

    summary_rows = (
        _info_row("Project", q.get("project_name", ""))
        + _info_row("Site Address", _nl2br(q.get("project_address", "")))
        + _info_row("Scope of Work", _nl2br(q.get("scope_of_work", "")))
        + _info_row("Validity", q.get("validity", ""))
    )

    payment_block = (
        f'<h3 style="color:#1e3a8a;margin:0 0 6px;font-size:14px;font-family:Arial,sans-serif;">Payment Schedule</h3>'
        f'<div style="color:#334155;font-size:13px;font-family:Arial,sans-serif;line-height:1.6;">{_nl2br(q.get("payment_schedule", ""))}</div>'
        if q.get("payment_schedule") else ""
    )

    terms_block = (
        f'<h3 style="color:#1e3a8a;margin:14px 0 6px;font-size:14px;font-family:Arial,sans-serif;">Terms &amp; Conditions</h3>'
        f'<div style="color:#334155;font-size:13px;font-family:Arial,sans-serif;line-height:1.6;">{_nl2br(q.get("terms_conditions", ""))}</div>'
        if q.get("terms_conditions") else ""
    )

    # Email clients (Gmail in particular) strip `flex`, drop <style> tags, and
    # sometimes mangle nested <div>s. We use table-based layout with inline
    # styles — the classic pattern that renders consistently across clients.
    return f"""
    <div style="background-color:#f4f6f9;padding:20px 0;font-family:Arial,sans-serif;">
    <table role="presentation" align="center" width="820" cellpadding="0" cellspacing="0"
           style="max-width:820px;width:100%;background-color:#ffffff;border-radius:8px;
                  border:1px solid #e2e8f0;margin:0 auto;">
        <tr>
            <td style="padding:24px;">
                <!-- Header -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:3px solid #3b82f6;margin-bottom:18px;">
                    <tr>
                        <td style="padding-bottom:10px;">
                            <div style="color:#1e3a8a;font-size:22px;font-weight:bold;font-family:Arial,sans-serif;">
                                Detailed Construction Quotation &amp; BOQ
                            </div>
                            <div style="color:#64748b;font-size:12px;margin-top:4px;font-family:Arial,sans-serif;">
                                Quotation No: <strong>{q.get('quotation_no', '')}</strong>
                                &nbsp;|&nbsp; Date: {datetime.now().strftime('%d %b %Y')}
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- Company / Client two-column row (table so Gmail keeps columns) -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
                    <tr>
                        <td width="50%" valign="top" style="padding-right:12px;">
                            <h3 style="color:#1e3a8a;margin:0 0 8px;font-size:14px;font-family:Arial,sans-serif;">Company Details</h3>
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-family:Arial,sans-serif;">
                                {company_rows}
                            </table>
                        </td>
                        <td width="50%" valign="top" style="padding-left:12px;border-left:1px solid #e2e8f0;">
                            <h3 style="color:#1e3a8a;margin:0 0 8px;font-size:14px;font-family:Arial,sans-serif;">Client Details</h3>
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-family:Arial,sans-serif;">
                                {client_rows}
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Summary -->
                <h3 style="color:#1e3a8a;margin:0 0 6px;font-size:14px;font-family:Arial,sans-serif;">Quotation Summary</h3>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:18px;font-family:Arial,sans-serif;">
                    {summary_rows}
                </table>

                <!-- BOQ -->
                <h3 style="color:#1e3a8a;margin:0 0 8px;font-size:14px;font-family:Arial,sans-serif;">Detailed Brief Quotation (BOQ)</h3>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="border-collapse:collapse;margin-bottom:18px;font-size:13px;font-family:Arial,sans-serif;">
                    <thead>
                        <tr style="background-color:#3b82f6;color:#ffffff;">
                            <th style="padding:10px;border:1px solid #3b82f6;text-align:center;">S.No</th>
                            <th style="padding:10px;border:1px solid #3b82f6;text-align:left;">Item / Description</th>
                            <th style="padding:10px;border:1px solid #3b82f6;text-align:center;">Unit</th>
                            <th style="padding:10px;border:1px solid #3b82f6;text-align:center;">Qty</th>
                            <th style="padding:10px;border:1px solid #3b82f6;text-align:right;">Rate</th>
                            <th style="padding:10px;border:1px solid #3b82f6;text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>{items_html}</tbody>
                    <tfoot>
                        <tr style="background-color:#f1f5f9;font-weight:bold;">
                            <td colspan="5" style="padding:10px;border:1px solid #e5e7eb;text-align:right;">Total Amount</td>
                            <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;">Rs. {float(q.get('total_amount', 0) or 0):,.2f}</td>
                        </tr>
                    </tfoot>
                </table>

                {payment_block}
                {terms_block}

                <!-- Signatory -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:40px;">
                    <tr>
                        <td align="right" style="font-family:Arial,sans-serif;">
                            <div style="display:inline-block;border-top:1px solid #cbd5e1;padding-top:6px;min-width:220px;text-align:right;">
                                <div style="color:#0f172a;font-weight:bold;font-size:13px;">Authorized Signatory</div>
                                <div style="color:#64748b;font-size:12px;margin-top:2px;">{company_name}</div>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    </div>
    """


def _send_email_with_pdf(
    to_email: str,
    subject: str,
    html_body: str,
    pdf_bytes: Optional[bytes],
    pdf_filename: str,
) -> bool:
    """Send a transactional email. If pdf_bytes is supplied, attach it as a PDF."""
    config = get_smtp_config()
    if not config.get("USER") or not config.get("PASS"):
        logger.error("SMTP credentials not configured")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = config["USER"]
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        if pdf_bytes:
            part = MIMEBase("application", "pdf")
            part.set_payload(pdf_bytes)
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="{pdf_filename}"',
            )
            msg.attach(part)

        if int(config["PORT"]) == 465:
            server = smtplib.SMTP_SSL(config["HOST"], int(config["PORT"]), timeout=15)
        else:
            server = smtplib.SMTP(config["HOST"], int(config["PORT"]), timeout=15)
            server.starttls()
        server.login(config["USER"], config["PASS"])
        server.send_message(msg)
        server.quit()
        logger.info("Quotation email sent to %s (attachment=%s)", to_email, bool(pdf_bytes))
        return True
    except Exception as e:
        logger.warning("Quotation email failed for %s: %s", to_email, e)
        return False


def _recalc_totals(data: dict) -> None:
    total = 0
    for it in data.get("items", []) or []:
        qty = float(it.get("qty", 0) or 0)
        rate = float(it.get("rate", 0) or 0)
        amt = float(it.get("amount") or qty * rate)
        it["amount"] = amt
        total += amt
    if not data.get("total_amount"):
        data["total_amount"] = total


@router.get("/", dependencies=[Depends(RBACPermission("Accounts", "view", "Quotations"))])
async def list_quotations(db=Depends(get_database)):
    rows = await db.quotations.find({}).sort("created_at", -1).to_list(500)
    return [quotation_helper(r) for r in rows]


@router.get("/{id}", dependencies=[Depends(RBACPermission("Accounts", "view", "Quotations"))])
async def get_quotation(id: str, db=Depends(get_database)):
    oid = validate_object_id(id, "Quotation ID")
    q = await db.quotations.find_one({"_id": oid})
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quotation_helper(q)


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RBACPermission("Accounts", "edit", "Quotations"))],
)
async def create_quotation(
    payload: QuotationCreate,
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    data = payload.model_dump()
    _recalc_totals(data)

    counter = await db.counters.find_one_and_update(
        {"_id": "quotation"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (counter or {}).get("seq", 1)
    data["quotation_no"] = f"QT-{seq:05d}"
    data["created_at"] = datetime.now()
    data["created_by"] = current_user.get("full_name") or current_user.get("username")
    data["status"] = data.get("status") or "Draft"

    result = await db.quotations.insert_one(data)
    new_q = await db.quotations.find_one({"_id": result.inserted_id})

    await log_activity(
        db,
        str(current_user.get("_id", current_user.get("username", "system"))),
        current_user.get("username", "system"),
        "Create Quotation",
        f"Quotation {data['quotation_no']} for {data['client_name']} | Project: {data['project_name']}",
        "info",
    )
    return quotation_helper(new_q)


@router.put("/{id}", dependencies=[Depends(RBACPermission("Accounts", "edit", "Quotations"))])
async def update_quotation(id: str, body: dict = Body(...), db=Depends(get_database)):
    oid = validate_object_id(id, "Quotation ID")
    valid_fields = {
        "client_name", "client_email", "client_phone", "client_address",
        "project_name", "project_address", "scope_of_work", "validity",
        "items", "payment_schedule", "terms_conditions", "total_amount",
        "notes", "status",
    }
    update_data = {k: v for k, v in body.items() if k in valid_fields}
    if "items" in update_data:
        _recalc_totals(update_data)
    update_data["updated_at"] = datetime.now()

    res = await db.quotations.update_one({"_id": oid}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quotation not found")
    q = await db.quotations.find_one({"_id": oid})
    return quotation_helper(q)


@router.delete("/{id}", dependencies=[Depends(RBACPermission("Accounts", "delete", "Quotations"))])
async def delete_quotation(
    id: str,
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    oid = validate_object_id(id, "Quotation ID")
    q = await db.quotations.find_one({"_id": oid})
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    await db.quotations.delete_one({"_id": oid})
    await log_activity(
        db,
        str(current_user.get("_id", current_user.get("username", "system"))),
        current_user.get("username", "system"),
        "Delete Quotation",
        f"Deleted quotation {q.get('quotation_no', id)}",
        "warning",
    )
    return {"success": True}


@router.post(
    "/{id}/send-email",
    dependencies=[Depends(RBACPermission("Accounts", "edit", "Quotations"))],
)
async def send_quotation_email(
    id: str,
    background_tasks: BackgroundTasks,
    email: Optional[str] = Form(None),
    pdf_file: Optional[UploadFile] = File(None),
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    """
    Send a quotation email. Accepts multipart/form-data:
      - `email`: recipient (falls back to client_email on record)
      - `pdf_file`: optional PDF generated by the client — attached to the email
    """
    oid = validate_object_id(id, "Quotation ID")
    q = await db.quotations.find_one({"_id": oid})
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    to_email = ((email or q.get("client_email") or "").strip())
    if not to_email or "@" not in to_email:
        raise HTTPException(
            status_code=400,
            detail="Valid client email is required to send this quotation.",
        )

    company = await db.settings.find_one({"type": "company_profile"}) or {}
    company.pop("_id", None)

    q_data = quotation_helper(q)
    html = generate_quotation_html(q_data, company)
    subject = f"Quotation {q_data['quotation_no']} - {q_data.get('project_name', '')}"

    pdf_bytes: Optional[bytes] = None
    pdf_filename = f"{q_data['quotation_no']}.pdf"
    if pdf_file is not None:
        pdf_bytes = await pdf_file.read()
        if pdf_file.filename:
            pdf_filename = pdf_file.filename

    if pdf_bytes:
        background_tasks.add_task(
            _send_email_with_pdf,
            to_email,
            subject,
            html,
            pdf_bytes,
            pdf_filename,
        )
    else:
        background_tasks.add_task(
            send_email,
            to_email=to_email,
            subject=subject,
            body=html,
            is_html=True,
        )

    await db.quotations.update_one(
        {"_id": oid},
        {"$set": {"status": "Sent", "sent_at": datetime.now(), "sent_to": to_email}},
    )

    await log_activity(
        db,
        str(current_user.get("_id", current_user.get("username", "system"))),
        current_user.get("username", "system"),
        "Send Quotation Email",
        f"Quotation {q_data['quotation_no']} emailed to {to_email}"
        + (" with PDF attachment" if pdf_bytes else ""),
        "success",
    )

    return {
        "message": f"Quotation emailed to {to_email}",
        "sent_to": to_email,
        "attachment": bool(pdf_bytes),
    }


@router.post(
    "/{id}/upload-pdf",
    dependencies=[Depends(RBACPermission("Accounts", "edit", "Quotations"))],
)
async def upload_quotation_pdf(
    id: str,
    pdf_file: UploadFile = File(...),
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    """Upload a generated quotation PDF to Cloudinary (or local fallback) and
    return a shareable URL — used by the WhatsApp share action so the client
    can download the PDF from the link included in the message."""
    oid = validate_object_id(id, "Quotation ID")
    q = await db.quotations.find_one({"_id": oid})
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    content = await pdf_file.read()
    filename = pdf_file.filename or f"{q.get('quotation_no', id)}.pdf"

    result = await upload_file(content, filename)
    if not result or not result.get("url"):
        raise HTTPException(
            status_code=500,
            detail="Failed to upload PDF. Check Cloudinary / storage configuration.",
        )

    url = result["url"]
    await db.quotations.update_one(
        {"_id": oid},
        {"$set": {"pdf_url": url, "pdf_generated_at": datetime.now()}},
    )

    await log_activity(
        db,
        str(current_user.get("_id", current_user.get("username", "system"))),
        current_user.get("username", "system"),
        "Upload Quotation PDF",
        f"PDF uploaded for quotation {q.get('quotation_no', id)} — {url}",
        "info",
    )

    return {"url": url, "type": result.get("type", "file")}
