"""
HTML Email Templates for Civil ERP Notifications
"""

from datetime import datetime


def get_base_template(title: str, body_html: str, company_name: str = "Civil ERP") -> str:
    """Wrap notification content in a styled email template."""
    year = datetime.now().year
    return f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%); padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; color: white; font-size: 20px; font-weight: 800;">{company_name}</h1>
            <p style="margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">{title}</p>
        </div>

        <!-- Body -->
        <div style="padding: 28px 32px; background-color: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            {body_html}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 16px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                This is an automated notification from {company_name}. Do not reply to this email.
            </p>
            <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1;">&copy; {year} {company_name}</p>
        </div>
    </div>
    """


def approval_email(item_type: str, item_name: str, status: str, approver: str,
                    project_name: str = "", reason: str = "", company_name: str = "Civil ERP") -> str:
    """Generate email for approval/rejection notifications."""
    is_approved = status.lower() in ("approved", "coordinator approved", "dept approved")
    status_color = "#10B981" if is_approved else "#EF4444"
    status_bg = "#D1FAE5" if is_approved else "#FEE2E2"

    body = f"""
        <div style="margin-bottom: 20px;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;
                         background-color: {status_bg}; color: {status_color};">{status}</span>
        </div>

        <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 800; color: #1e293b;">{item_type} {status}</h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; width: 120px;">Item</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; font-size: 14px;">{item_name}</td>
            </tr>
            {"<tr><td style='padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px;'>Project</td><td style='padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; font-size: 14px;'>" + project_name + "</td></tr>" if project_name else ""}
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px;">{"Approved" if is_approved else "Rejected"} by</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; font-size: 14px;">{approver}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Date</td>
                <td style="padding: 10px 0; font-weight: 600; font-size: 14px;">{datetime.now().strftime('%d %b %Y, %I:%M %p')}</td>
            </tr>
        </table>

        {"<div style='padding: 12px 16px; background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 6px; margin-bottom: 20px;'><strong>Reason:</strong> " + reason + "</div>" if reason else ""}

        <p style="font-size: 13px; color: #64748b;">Please log in to the ERP system for more details.</p>
    """

    return get_base_template(f"{item_type} {status}", body, company_name)


def digest_email(username: str, notifications: list, company_name: str = "Civil ERP") -> str:
    """Generate daily digest email with notification summary."""
    # Group by event_type
    groups = {}
    for n in notifications:
        evt = n.get("event_type", "system")
        if evt not in groups:
            groups[evt] = []
        groups[evt].append(n)

    type_labels = {
        "approval": "Approvals",
        "workflow": "Workflow Updates",
        "material": "Material Updates",
        "finance": "Finance Updates",
        "hr": "HR Updates",
        "task": "Task Updates",
        "project": "Project Updates",
        "fleet": "Fleet Updates",
        "system": "System",
    }

    type_colors = {
        "approval": "#F59E0B",
        "workflow": "#3B82F6",
        "material": "#10B981",
        "finance": "#8B5CF6",
        "hr": "#EC4899",
        "task": "#EF4444",
        "project": "#0EA5E9",
        "fleet": "#6B7280",
        "system": "#6B7280",
    }

    sections_html = ""
    for evt_type, items in groups.items():
        color = type_colors.get(evt_type, "#6B7280")
        label = type_labels.get(evt_type, evt_type.title())

        items_html = ""
        for item in items[:10]:  # Max 10 per category
            time_str = ""
            if item.get("created_at"):
                try:
                    dt = item["created_at"] if isinstance(item["created_at"], datetime) else datetime.fromisoformat(str(item["created_at"]))
                    time_str = dt.strftime("%I:%M %p")
                except Exception:
                    pass

            priority_badge = ""
            if item.get("priority") == "high":
                priority_badge = '<span style="font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 8px; background: #FEE2E2; color: #EF4444; margin-left: 6px;">HIGH</span>'

            items_html += f"""
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #f8fafc; font-size: 13px; color: #475569;">
                    <strong>{item.get('title', '')}</strong>{priority_badge}<br/>
                    <span style="color: #94a3b8; font-size: 12px;">{item.get('content', '')[:120]}</span>
                </td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #f8fafc; font-size: 11px; color: #94a3b8; white-space: nowrap; vertical-align: top;">{time_str}</td>
            </tr>
            """

        sections_html += f"""
        <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background-color: {color};"></div>
                <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b;">{label} ({len(items)})</h3>
            </div>
            <table style="width: 100%; border-collapse: collapse; background: #fafbfc; border-radius: 8px; overflow: hidden;">
                {items_html}
            </table>
        </div>
        """

    body = f"""
        <p style="font-size: 15px; color: #475569; margin-bottom: 20px;">
            Hi <strong>{username}</strong>, here's your daily notification summary:
        </p>

        <div style="padding: 14px 18px; background: linear-gradient(135deg, #EFF6FF, #F0FDF4); border-radius: 10px; margin-bottom: 24px; text-align: center;">
            <span style="font-size: 28px; font-weight: 800; color: #1e293b;">{len(notifications)}</span>
            <span style="font-size: 14px; color: #64748b; margin-left: 8px;">unread notifications</span>
        </div>

        {sections_html}

        <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 13px; color: #94a3b8;">Log in to the ERP system to view full details and take action.</p>
        </div>
    """

    return get_base_template(f"Daily Summary - {datetime.now().strftime('%d %b %Y')}", body, company_name)
