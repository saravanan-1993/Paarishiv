import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.api.finance import create_expense
from app.models.finance import ExpenseBase

async def test():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["civil_erp"]
    expense = ExpenseBase(amount=31122.5, base_amount=26375, gst_amount=4747.5, invoice_no="100013", paymentMode="NEFT/RTGS", mark_as_paid=True, project="General")
    try:
        res = await create_expense(expense, db)
        print("Success:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
