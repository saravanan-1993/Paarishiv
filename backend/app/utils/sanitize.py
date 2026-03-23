"""C12 Fix: XSS sanitization for user-generated content."""
import re

# Pattern to match HTML tags (script, iframe, object, embed, etc.)
_DANGEROUS_TAGS = re.compile(
    r'<\s*/?\s*(script|iframe|object|embed|applet|form|input|button|textarea|select|link|meta|style|base)\b[^>]*>',
    re.IGNORECASE
)
# Pattern to match event handler attributes
_EVENT_HANDLERS = re.compile(
    r'\bon\w+\s*=',
    re.IGNORECASE
)
# Pattern to match javascript: / data: / vbscript: URLs
_DANGEROUS_URLS = re.compile(
    r'(javascript|vbscript|data)\s*:',
    re.IGNORECASE
)


def sanitize_string(value: str) -> str:
    """Remove dangerous HTML/JS content from a string."""
    if not isinstance(value, str):
        return value
    # Strip dangerous tags
    value = _DANGEROUS_TAGS.sub('', value)
    # Strip event handlers
    value = _EVENT_HANDLERS.sub('', value)
    # Strip dangerous URL schemes
    value = _DANGEROUS_URLS.sub('', value)
    return value


def sanitize_dict(data: dict, fields: list = None) -> dict:
    """Sanitize specified fields (or all string fields) in a dict."""
    if fields:
        for field in fields:
            if field in data and isinstance(data[field], str):
                data[field] = sanitize_string(data[field])
    else:
        for key, val in data.items():
            if isinstance(val, str):
                data[key] = sanitize_string(val)
            elif isinstance(val, list):
                data[key] = sanitize_list(val)
    return data


def sanitize_list(items: list) -> list:
    """Sanitize all string values in a list of dicts/strings."""
    result = []
    for item in items:
        if isinstance(item, dict):
            result.append(sanitize_dict(item))
        elif isinstance(item, str):
            result.append(sanitize_string(item))
        else:
            result.append(item)
    return result
