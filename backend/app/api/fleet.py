from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from app.models.fleet import VehicleBase, TripBase, MaintenanceRecord, FuelStock, FuelLog, EquipmentBase, TripRequestCreate
from database import get_database
from bson import ObjectId
from datetime import datetime
from app.utils.rbac import RBACPermission
from app.utils.auth import get_current_user, validate_object_id

router = APIRouter(prefix="/fleet", tags=["fleet"])

# ── Vehicles ──────────────────────────────────────────────────────────────────

# C4 Fix: Auth on all fleet GET routes
@router.get("/vehicles", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_vehicles(db = Depends(get_database)):
    vehicles = await db.vehicles.find().to_list(100)
    return [{"id": str(v["_id"]), **{k: v for k, v in v.items() if k != "_id"}} for v in vehicles]

@router.post("/vehicles", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def create_vehicle(vehicle: VehicleBase, db = Depends(get_database)):
    result = await db.vehicles.insert_one(vehicle.dict())
    return {"id": str(result.inserted_id), **vehicle.dict()}

@router.put("/vehicles/{vehicle_id}", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def update_vehicle(vehicle_id: str, vehicle: dict, db = Depends(get_database)):
    oid = validate_object_id(vehicle_id, "vehicle")
    if "_id" in vehicle: del vehicle["_id"]
    # C13 Fix: Verify record exists before update
    result = await db.vehicles.update_one({"_id": oid}, {"$set": vehicle})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"success": True}

@router.delete("/vehicles/{vehicle_id}", dependencies=[Depends(RBACPermission("Fleet Management", "delete"))])
async def delete_vehicle(vehicle_id: str, db = Depends(get_database)):
    oid = validate_object_id(vehicle_id, "vehicle")
    # C13 Fix: Verify record exists before delete
    result = await db.vehicles.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"success": True}

# ── Equipment (Plant & Machinery) ─────────────────────────────────────────────

@router.get("/equipment", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_equipment(db=Depends(get_database)):
    equipment = await db.equipment.find().to_list(500)
    return [{"id": str(e["_id"]), **{k: v for k, v in e.items() if k != "_id"}} for e in equipment]

@router.post("/equipment", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def create_equipment(equipment: EquipmentBase, db=Depends(get_database)):
    data = equipment.dict()
    data["createdAt"] = datetime.now()
    result = await db.equipment.insert_one(data)
    data["createdAt"] = data["createdAt"].isoformat()
    return {"id": str(result.inserted_id), **data}

@router.put("/equipment/{equipment_id}", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def update_equipment(equipment_id: str, equipment: dict, db=Depends(get_database)):
    oid = validate_object_id(equipment_id, "equipment")
    if "_id" in equipment:
        del equipment["_id"]
    if "id" in equipment:
        del equipment["id"]
    equipment["updatedAt"] = datetime.now()
    result = await db.equipment.update_one({"_id": oid}, {"$set": equipment})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return {"success": True}

@router.delete("/equipment/{equipment_id}", dependencies=[Depends(RBACPermission("Fleet Management", "delete"))])
async def delete_equipment(equipment_id: str, db=Depends(get_database)):
    oid = validate_object_id(equipment_id, "equipment")
    result = await db.equipment.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return {"success": True}

# ── Trips ─────────────────────────────────────────────────────────────────────

@router.get("/trips", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_trips(db = Depends(get_database)):
    trips = await db.trips.find().sort("date", -1).to_list(500)
    return [{"id": str(t["_id"]), **{k: v for k, v in t.items() if k != "_id"}} for t in trips]

@router.post("/trips", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def create_trip(trip: TripBase, db = Depends(get_database)):
    trip_data = trip.dict()
    # Validate non-negative amounts
    if float(trip_data.get("totalRevenue", 0) or 0) < 0:
        raise HTTPException(status_code=400, detail="Revenue cannot be negative")
    if float(trip_data.get("totalExpense", 0) or 0) < 0:
        raise HTTPException(status_code=400, detail="Expense cannot be negative")
    trip_data["netProfit"] = float(trip_data.get("totalRevenue", 0) or 0) - float(trip_data.get("totalExpense", 0) or 0)
    result = await db.trips.insert_one(trip_data)
    if "_id" in trip_data: del trip_data["_id"]
    return {"id": str(result.inserted_id), **trip_data}

@router.put("/trips/{trip_id}", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def update_trip(trip_id: str, trip_update: dict, db = Depends(get_database)):
    oid = validate_object_id(trip_id, "trip")
    if "_id" in trip_update: del trip_update["_id"]

    # Fetch existing trip to ensure calculated fields remain correct
    existing_trip = await db.trips.find_one({"_id": oid})
    if not existing_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    # Merge existing data with update
    revenue = trip_update.get("totalRevenue", existing_trip.get("totalRevenue", 0))
    expenses = trip_update.get("totalExpense", existing_trip.get("totalExpense", 0))
    
    trip_update["netProfit"] = revenue - expenses
        
    await db.trips.update_one({"_id": ObjectId(trip_id)}, {"$set": trip_update})
    return {"success": True}

@router.delete("/trips/{trip_id}", dependencies=[Depends(RBACPermission("Fleet Management", "delete"))])
async def delete_trip(trip_id: str, db = Depends(get_database)):
    oid = validate_object_id(trip_id, "trip")
    # C13 Fix: Verify record exists before delete
    result = await db.trips.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"success": True}

# ── Stats & Dashboard ─────────────────────────────────────────────────────────

@router.get("/stats/summary", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_fleet_summary(db = Depends(get_database)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # All trips for total stats
    all_trips = await db.trips.find().to_list(5000)
    
    total_revenue = sum(t.get("totalRevenue", 0) for t in all_trips)
    total_expense = sum(t.get("totalExpense", 0) for t in all_trips)
    total_profit = sum(t.get("netProfit", 0) for t in all_trips)
    
    # Today's trips calculation (safer check)
    today_trips = []
    for t in all_trips:
        trip_date = t.get("date")
        if not trip_date:
            continue
            
        if isinstance(trip_date, str):
            try:
                # Handle ISO format strings
                dt = datetime.fromisoformat(trip_date.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                continue
        elif isinstance(trip_date, datetime):
            dt = trip_date.replace(tzinfo=None)
        else:
            continue
            
        if dt >= today:
            today_trips.append(t)
    
    today_revenue = sum(t.get("totalRevenue", 0) for t in today_trips)
    today_count = len(today_trips)
    
    summary = {
        "todayTrips": today_count,
        "todayRevenue": today_revenue,
        "totalRevenue": total_revenue,
        "totalExpense": total_expense,
        "netProfit": total_profit
    }
    
    # Vehicle wise profit
    vehicle_stats = {}
    for t in all_trips:
        v_num = t.get("vehicleNumber", "Unknown")
        if v_num not in vehicle_stats:
            vehicle_stats[v_num] = {"vehicle": v_num, "trips": 0, "revenue": 0, "expense": 0, "profit": 0}
        
        stat = vehicle_stats[v_num]
        stat["trips"] += 1
        stat["revenue"] += t.get("totalRevenue", 0)
        stat["expense"] += t.get("totalExpense", 0)
        stat["profit"] += t.get("netProfit", 0)
        
    return {
        "summary": summary,
        "vehicleStats": list(vehicle_stats.values())
    }

# ── Maintenance ───────────────────────────────────────────────────────────────

@router.post("/maintenance", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def add_maintenance(record: MaintenanceRecord, db = Depends(get_database)):
    # C13 Fix: Validate vehicleId exists before creating maintenance record
    v_oid = validate_object_id(record.vehicleId, "vehicle")
    vehicle = await db.vehicles.find_one({"_id": v_oid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    result = await db.maintenance.insert_one(record.dict())

    # Update vehicle's last service info
    await db.vehicles.update_one(
        {"_id": v_oid},
        {"$set": {
            "lastServiceDate": record.date,
            "currentKm": record.odometer
        }}
    )
    return {"id": str(result.inserted_id), **record.dict()}

@router.get("/maintenance/{vehicle_id}", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_vehicle_maintenance(vehicle_id: str, db = Depends(get_database)):
    records = await db.maintenance.find({"vehicleId": vehicle_id}).sort("date", -1).to_list(100)
    return [{"id": str(r["_id"]), **{k: v for k, v in r.items() if k != "_id"}} for r in records]

# ── Fuel Management ──────────────────────────────────────────────────────────

@router.get("/fuel/stock", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_fuel_stock(project_name: Optional[str] = None, db = Depends(get_database)):
    query = {}
    if project_name and project_name not in ["all", "All Sites"]:
        query["site"] = project_name
        
    stocks = await db.fuel_stock.find(query).sort("date", -1).to_list(500)
    return [{"id": str(s["_id"]), **{k: v for k, v in s.items() if k != "_id"}} for s in stocks]

@router.post("/fuel/stock", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def add_fuel_stock(stock_data: dict = Body(...), db=Depends(get_database), current_user: dict=Depends(get_current_user)):
    qty = float(stock_data.get("qty", 0) or 0)
    rate = float(stock_data.get("rate", 0) or 0)
    total = float(stock_data.get("totalAmount", 0) or 0) or (qty * rate)
    stock_doc = {
        "date": datetime.now(),
        "qty": qty,
        "rate": rate,
        "totalAmount": total,
        "supplier": stock_data.get("supplier", ""),
        "billNo": stock_data.get("billNo", ""),
        "site": stock_data.get("site", ""),
        "remarks": stock_data.get("remarks", ""),
        "addedBy": stock_data.get("addedBy") or current_user.get("username", "System"),
    }
    result = await db.fuel_stock.insert_one(stock_doc)

    # Auto-create expense entry in accounts for fuel purchase
    if total > 0:
        expense_doc = {
            "category": "Fuel/Diesel",
            "amount": total,
            "project": stock_doc["site"] or "General",
            "payee": stock_doc["supplier"] or "Fuel Purchase",
            "paymentMode": "Cash",
            "reference": stock_doc["billNo"],
            "description": f"Diesel Purchase - {qty}L @ Rs.{rate}/L" + (f" ({stock_doc['supplier']})" if stock_doc["supplier"] else ""),
            "date": datetime.now().isoformat(),
            "invoice_no": stock_doc["billNo"],
            "voucher_no": "",
            "status": "Recorded",
            "source": "fuel_stock",
            "base_amount": total,
            "gst_amount": 0,
            "created_by": stock_doc["addedBy"]
        }
        await db.expenses.insert_one(expense_doc)

        # Update project spent
        if stock_doc["site"] and stock_doc["site"] != "General":
            await db.projects.update_one(
                {"name": stock_doc["site"]},
                {"$inc": {"spent": total}}
            )

    stock_doc["date"] = stock_doc["date"].isoformat()
    stock_doc.pop("_id", None)  # Remove ObjectId added by insert_one
    return {"id": str(result.inserted_id), **stock_doc}

@router.get("/fuel/logs", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_fuel_logs(project_name: Optional[str] = None, db = Depends(get_database)):
    query = {}
    if project_name and project_name not in ["all", "All Sites"]:
        query["site"] = project_name
        
    logs = await db.fuel_logs.find(query).sort("date", -1).to_list(1000)
    return [{"id": str(l["_id"]), **{k: v for k, v in l.items() if k != "_id"}} for l in logs]

@router.post("/fuel/logs", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def add_fuel_log(log_data: dict = Body(...), db=Depends(get_database), current_user: dict=Depends(get_current_user)):
    try:
        log_doc = {
            "date": log_data.get("date", datetime.now().strftime("%Y-%m-%d")),
            "assetId": log_data.get("assetId", ""),
            "assetName": log_data.get("assetName", ""),
            "site": log_data.get("site", ""),
            "qty": float(log_data.get("qty", 0) or 0),
            "hoursRun": float(log_data.get("hoursRun", 0) or 0),
            "engineer": log_data.get("engineer", ""),
            "type": log_data.get("type", "Consumption"),
            "remarks": log_data.get("remarks", ""),
            "created_at": datetime.now().isoformat(),
        }
        result = await db.fuel_logs.insert_one(log_doc)

        # Calculate fuel cost from latest stock rate for this site
        qty = log_doc["qty"]
        if qty > 0:
            try:
                query = {"site": log_doc["site"]} if log_doc["site"] else {}
                recent_stock = await db.fuel_stock.find(query).sort("date", -1).to_list(1)
                rate = float(recent_stock[0].get("rate", 0)) if recent_stock else 0
                fuel_cost = round(qty * rate, 2)

                if fuel_cost > 0:
                    expense_doc = {
                        "category": "Fuel/Diesel",
                        "amount": fuel_cost,
                        "project": log_doc["site"] or "General",
                        "payee": "Fuel Consumption",
                        "paymentMode": "Internal",
                        "reference": "",
                        "description": f"Diesel Consumption - {log_doc['assetName']} ({qty}L x Rs.{rate}/L) | {log_doc['engineer']}",
                        "date": log_doc["date"],
                        "voucher_no": "",
                        "status": "Recorded",
                        "source": "fuel_log",
                        "base_amount": fuel_cost,
                        "gst_amount": 0,
                        "created_by": current_user.get("username", "System")
                    }
                    await db.expenses.insert_one(expense_doc)
            except Exception:
                pass

        log_doc.pop("_id", None)  # Remove ObjectId added by insert_one
        return {"id": str(result.inserted_id), **log_doc}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ── Trip Requests ─────────────────────────────────────────────────────────────

@router.get("/trip-requests", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_trip_requests(db=Depends(get_database)):
    reqs = await db.trip_requests.find().sort("created_at", -1).to_list(500)
    for r in reqs:
        r["id"] = str(r["_id"])
        del r["_id"]
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return reqs

@router.post("/trip-requests", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def create_trip_request(data: TripRequestCreate, db=Depends(get_database), current_user=Depends(get_current_user)):
    doc = data.dict()
    doc["requested_by"] = current_user.get("full_name") or current_user.get("username", "")
    doc["requested_by_username"] = current_user.get("username", "")
    doc["status"] = "Pending"
    doc["created_at"] = datetime.now()
    result = await db.trip_requests.insert_one(doc)
    doc.pop("_id", None)
    doc["created_at"] = doc["created_at"].isoformat()
    doc["id"] = str(result.inserted_id)
    return doc

@router.put("/trip-requests/{req_id}/assign", dependencies=[Depends(RBACPermission("Fleet Management", "edit"))])
async def assign_trip_request(req_id: str, assign_data: dict = Body(...), db=Depends(get_database), current_user=Depends(get_current_user)):
    """Admin assigns vehicle/driver to an approved trip request → creates actual trip + project expense."""
    oid = validate_object_id(req_id, "trip request")
    req = await db.trip_requests.find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    if req.get("status") != "Approved":
        raise HTTPException(status_code=400, detail="Trip request is not approved yet")

    vehicle_id = assign_data.get("vehicleId", "")
    vehicle_number = assign_data.get("vehicleNumber", "")
    driver_id = assign_data.get("driverId", "")
    driver_name = assign_data.get("driverName", "")
    rate_per_load = float(assign_data.get("ratePerLoad", 0) or 0)
    transport_cost = float(assign_data.get("transportCost", 0) or 0)

    # Auto-generate trip ID
    count = await db.trips.count_documents({})
    trip_id = str(count + 1).zfill(4)

    trip_doc = {
        "tripId": trip_id,
        "vehicleId": vehicle_id,
        "vehicleNumber": vehicle_number,
        "driverId": driver_id,
        "driverName": driver_name,
        "loadType": req.get("load_type", ""),
        "fromLocation": req.get("from_location", ""),
        "toLocation": req.get("to_location", ""),
        "projectId": req.get("project_id", ""),
        "projectName": req.get("project_name", ""),
        "tripType": "Project Trip",
        "ratePerLoad": rate_per_load,
        "totalRevenue": 0.0,
        "totalExpense": transport_cost,
        "netProfit": -transport_cost,
        "status": "Open",
        "date": datetime.now(),
        "paymentStatus": "Pending",
        "trip_request_id": req_id,
        "expenses": [{"category": "Transport", "amount": transport_cost, "remarks": f"Trip request: {req.get('load_type', '')}"}] if transport_cost > 0 else [],
    }
    trip_result = await db.trips.insert_one(trip_doc)

    # Add transport cost as project expense
    if transport_cost > 0 and req.get("project_name"):
        await db.expenses.insert_one({
            "category": "Transport",
            "amount": transport_cost,
            "project": req.get("project_name", ""),
            "payee": vehicle_number or "Transport",
            "paymentMode": "Cash",
            "description": f"Transport: {req.get('load_type', '')} | {req.get('from_location', '')} → {req.get('to_location', '')} | {req.get('quantity', '')} {req.get('quantity_unit', '')}",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "base_amount": transport_cost,
            "gst_amount": 0,
            "source": "fleet_trip",
            "trip_id": str(trip_result.inserted_id),
            "status": "Recorded",
        })
        await db.projects.update_one(
            {"name": req.get("project_name", "")},
            {"$inc": {"spent": transport_cost}}
        )

    # Mark trip request as assigned
    await db.trip_requests.update_one({"_id": oid}, {"$set": {
        "status": "Assigned",
        "assigned_vehicle": vehicle_number,
        "assigned_driver": driver_name,
        "trip_id": str(trip_result.inserted_id),
        "assigned_at": datetime.now(),
        "assigned_by": current_user.get("full_name") or current_user.get("username", ""),
    }})

    return {"success": True, "trip_id": str(trip_result.inserted_id), "message": "Vehicle assigned and trip created"}

@router.get("/fuel/summary", dependencies=[Depends(RBACPermission("Fleet Management", "view"))])
async def get_fuel_summary(project_name: Optional[str] = None, db = Depends(get_database)):
    query = {}
    if project_name and project_name not in ["all", "All Sites"]:
        query["site"] = project_name
        
    # Total stock in
    stocks = await db.fuel_stock.find(query).to_list(5000)
    total_in = sum(s.get("qty", 0) for s in stocks)
    
    # Total consumption
    logs = await db.fuel_logs.find(query).to_list(10000)
    total_out = sum(l.get("qty", 0) for l in logs)
    
    # Current stock
    current_stock = total_in - total_out
    
    # Bug 5.3 - Consumption this month (proper date comparison)
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_logs = []
    for l in logs:
        log_date = l.get("date")
        if not log_date:
            continue
        if isinstance(log_date, str):
            try:
                log_date = datetime.fromisoformat(log_date.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                continue
        elif isinstance(log_date, datetime):
            log_date = log_date.replace(tzinfo=None)
        else:
            continue
        if log_date >= month_start:
            month_logs.append(l)
    month_out = sum(l.get("qty", 0) for l in month_logs)
    
    return {
        "currentStock": round(current_stock, 2),
        "monthUsage": round(month_out, 2),
        "recentLogs": [{"id": str(l["_id"]), **{k: v for k, v in l.items() if k != "_id"}} for l in logs[:10]]
    }
