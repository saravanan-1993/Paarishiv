import os
import re

def fix_hardcoded_urls(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.js', '.jsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Basic replacements
                new_content = content.replace("`http://${window.location.hostname}:8000`", "'/api'")
                new_content = new_content.replace('`http://${host}:8000`', "'/api'")
                
                # NotificationContext.jsx
                new_content = new_content.replace('`ws://${host}:8000/chat/ws/${user.username}`', '`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/chat/ws/${user.username}`')
                new_content = new_content.replace('`http://${window.location.hostname}:8000/chat', '`/api/chat')
                
                # Chat.jsx
                new_content = new_content.replace('const WS_BASE = `ws://${host}:8000`;', 'const WS_BASE = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api`;')
                new_content = new_content.replace('const API_BASE = `http://${host}:8000`;', "const API_BASE = '/api';")
                
                # DPRViewModal.jsx - existing code uses VITE_API_URL || http://...:8000
                new_content = new_content.replace('`${import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`}${url}`', '`/api${url}`')
                
                # Settings.jsx and Sidebar.jsx
                new_content = new_content.replace("`http://${window.location.hostname}:8000${companyInfo.logo}`", "`/api${companyInfo.logo}`")
                
                if new_content != content:
                    print(f"Fixing {filepath}")
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    fix_hardcoded_urls(os.path.abspath('frontend/src'))
