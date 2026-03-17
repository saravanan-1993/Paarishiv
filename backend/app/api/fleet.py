from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.fleet import VehicleBase, TripBase, MaintenanceRecord, FuelStock, FuelLog
from database import get_database
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/fleet", tags=["fleet"])

# ── Vehicles ──────────────────────────────────────────────────────────────────

@router.get("/vehicles")
async def get_vehicles(db = Depends(get_database)):
    vehicles = await db.vehicles.find().to_list(100)
    return [{"id": str(v["_id"]), **{k: v for k, v in v.items() if k != "_id"}} for v in vehicles]

@router.post("/vehicles")
async def create_vehicle(vehicle: VehicleBase, db = Depends(get_database)):
    result = await db.vehicles.insert_one(vehicle.dict())
    return {"id": str(result.inserted_id), **vehicle.dict()}

@router.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, vehicle: dict, db = Depends(get_database)):
    if "_id" in vehicle: del vehicle["_id"]
    await db.vehicles.update_one({"_id": ObjectId(vehicle_id)}, {"$set": vehicle})
    return {"success": True}

@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, db = Depends(get_database)):
    await db.vehicles.delete_one({"_id": ObjectId(vehicle_id)})
    return {"success": True}

# ── Trips ─────────────────────────────────────────────────────────────────────

@router.get("/trips")
async def get_trips(db = Depends(get_database)):
    trips = await db.trips.find().sort("date", -1).to_list(500)
    return [{"id": str(t["_id"]), **{k: v for k, v in t.items() if k != "_id"}} for t in trips]

@router.post("/trips")
async def create_trip(trip: TripBase, db = Depends(get_database)):
    trip_data = trip.dict()
    # Auto-calc if possible, though initially it might be 0
    trip_data["netProfit"] = trip_data["totalRevenue"] - trip_data["totalExpense"]
    result = await db.trips.insert_one(trip_data)
    if "_id" in trip_data: del trip_data["_id"]
    return {"id": str(result.inserted_id), **trip_data}

@router.put("/trips/{trip_id}")
async def update_trip(trip_id: str, trip_update: dict, db = Depends(get_database)):
    if "_id" in trip_update: del trip_update["_id"]
    
    # Fetch existing trip to ensure calculated fields remain correct
    existing_trip = await db.trips.find_one({"_id": ObjectId(trip_id)})
    if not existing_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    # Merge existing data with update
    revenue = trip_update.get("totalRevenue", existing_trip.get("totalRevenue", 0))
    expenses = trip_update.get("totalExpense", existing_trip.get("totalExpense", 0))
    
    trip_update["netProfit"] = revenue - expenses
        
    await db.trips.update_one({"_id": ObjectId(trip_id)}, {"$set": trip_update})
    return {"success": True}

@router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, db = Depends(get_database)):
    await db.trips.delete_one({"_id": ObjectId(trip_id)})
    return {"success": True}

# ── Stats & Dashboard ─────────────────────────────────────────────────────────

@router.get("/stats/summary")
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

@router.post("/maintenance")
async def add_maintenance(record: MaintenanceRecord, db = Depends(get_database)):
    result = await db.maintenance.insert_one(record.dict())
    
    # Update vehicle's last service info
    await db.vehicles.update_one(
        {"_id": ObjectId(record.vehicleId)},
        {"$set": {
            "lastServiceDate": record.date,
            "currentKm": record.odometer
        }}
    )
    return {"id": str(result.inserted_id), **record.dict()}

@router.get("/maintenance/{vehicle_id}")
async def get_vehicle_maintenance(vehicle_id: str, db = Depends(get_database)):
    records = await db.maintenance.find({"vehicleId": vehicle_id}).sort("date", -1).to_list(100)
    return [{"id": str(r["_id"]), **{k: v for k, v in r.items() if k != "_id"}} for r in records]

# ── Fuel Management ──────────────────────────────────────────────────────────

@router.get("/fuel/stock")
async def get_fuel_stock(project_name: Optional[str] = None, db = Depends(get_database)):
    query = {}
    if project_name and project_name not in ["all", "All Sites"]:
        query["site"] = project_name
        
    stocks = await db.fuel_stock.find(query).sort("date", -1).to_list(500)
    return [{"id": str(s["_id"]), **{k: v for k, v in s.items() if k != "_id"}} for s in stocks]

@router.post("/fuel/stock")
async def add_fuel_stock(stock: FuelStock, db = Depends(get_database)):
    result = await db.fuel_stock.insert_one(stock.dict())
    return {"id": str(result.inserted_id), **stock.dict()}

@router.get("/fuel/logs")
async def get_fuel_logs(project_name: Optional[str] = None, db = Depends(get_database)):
    query = {}
    if project_name and project_name not in ["all", "All Sites"]:
        query["site"] = project_name
        
    logs = await db.fuel_logs.find(query).sort("date", -1).to_list(1000)
    return [{"id": str(l["_id"]), **{k: v for k, v in l.items() if k != "_id"}} for l in logs]

@router.post("/fuel/logs")
async def add_fuel_log(log: FuelLog, db = Depends(get_database)):
    result = await db.fuel_logs.insert_one(log.dict())
    return {"id": str(result.inserted_id), **log.dict()}

@router.get("/fuel/summary")
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
    
    # Consumption this month
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d")
    month_logs = [l for l in logs if str(l.get("date")) >= month_start]
    month_out = sum(l.get("qty", 0) for l in month_logs)
    
    return {
        "currentStock": round(current_stock, 2),
        "monthUsage": round(month_out, 2),
        "recentLogs": [{"id": str(l["_id"]), **{k: v for k, v in l.items() if k != "_id"}} for l in logs[:10]]
    }
