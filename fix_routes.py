import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Skip if already has await getDb()
    if 'await getDb()' in content:
        return False
    
    # Fix: const db = getDb() -> const db = await getDb()
    content = re.sub(r'const db = getDb\(\)', 'const db = await getDb()', content)
    
    # Fix db.prepare(...).get(...) -> await db.prepare(...).get(...)
    content = re.sub(r'db\.prepare\(([^)]+)\)\.get\(([^)]*)\)', r'await db.prepare(\1).get(\2)', content)
    
    # Fix db.prepare(...).run(...) -> await db.prepare(...).run(...)
    content = re.sub(r'db\.prepare\(([^)]+)\)\.run\(([^)]*)\)', r'await db.prepare(\1).run(\2)', content)
    
    # Fix db.prepare(...).all(...) -> await db.prepare(...).all(...)
    content = re.sub(r'db\.prepare\(([^)]+)\)\.all\(([^)]*)\)', r'await db.prepare(\1).all(\2)', content)
    
    # Fix db.prepare(...).exec(...) -> await db.prepare(...).exec(...)
    content = re.sub(r'db\.prepare\(([^)]+)\)\.exec\(([^)]*)\)', r'await db.prepare(\1).exec(\2)', content)
    
    # Fix db.exec(...) -> await db.exec(...)
    content = re.sub(r'db\.exec\(([^)]+)\)', r'db.exec(\1)', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    return True

api_dir = '/Users/tjmacmini/Desktop/photo-dashboard/src/app/api'
for root, dirs, files in os.walk(api_dir):
    for file in files:
        if file == 'route.ts':
            filepath = os.path.join(root, file)
            fix_file(filepath)
            print(f"Fixed: {filepath}")

print("Done!")
