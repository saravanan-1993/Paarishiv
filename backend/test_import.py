
try:
    from app.api import finance
    print("Finance imported successfully")
except Exception as e:
    import traceback
    traceback.print_exc()
