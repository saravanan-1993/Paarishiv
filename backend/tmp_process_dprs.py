
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

async def process_existing_dprs():
    mongo_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DATABASE_NAME', 'civil_erp')
    
    print(f'Connecting to {db_name}...')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    projects = await db.projects.find({}).to_list(None)
    
    count = 0
    for p in projects:
        project_id = str(p['_id'])
        project_name = p.get('name', 'Unknown')
        engineer_id = p.get('engineer_id', 'Site Engineer')
        
        dprs = p.get('dprs', [])
        for dpr in dprs:
            mats = dpr.get('next_day_materials', [])
            dpr_id = dpr.get('id')
            
            if not mats:
                continue
                
            # Check if we already created a request for this DPR
            existing = await db.material_requests.find_one({'source_id': dpr_id})
            if existing:
                continue
                
            requested_items = []
            for item in mats:
                # Support both 'material' and 'name' keys
                mat_name = item.get('material') or item.get('name')
                qty_str = item.get('qty') or item.get('quantity')
                
                if mat_name and qty_str:
                    try:
                        qty = float(qty_str)
                        if qty > 0:
                            requested_items.append({
                                'name': mat_name,
                                'quantity': qty,
                                'unit': item.get('unit', 'Nos')
                            })
                    except:
                        continue
            
            if requested_items:
                mat_request = {
                    'project_id': project_id,
                    'project_name': project_name,
                    'engineer_id': engineer_id,
                    'requested_items': requested_items,
                    'priority': 'Medium',
                    'status': 'Pending',
                    'created_at': datetime.now(),
                    'source': 'DPR (Sync)',
                    'source_id': dpr_id,
                    'issued_items': []
                }
                await db.material_requests.insert_one(mat_request)
                print(f'Created request for Project: {project_name}, DPR: {dpr_id}')
                count += 1
    
    print(f'Total historical requests created: {count}')

if __name__ == '__main__':
    asyncio.run(process_existing_dprs())
