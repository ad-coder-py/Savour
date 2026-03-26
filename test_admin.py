import urllib.request
import json

url = "http://localhost:3000/api/admin/list_pending"
req = urllib.request.Request(url, data=json.dumps({}).encode('utf-8'), headers={'Content-Type': 'application/json'})

try:
    print("Fetching pending list...")
    with urllib.request.urlopen(req, timeout=10) as f:
        print(f"Status: {f.status}")
        data = json.loads(f.read().decode('utf-8'))
        print(f"Pending count: {len(data)}")
        print(f"Data: {json.dumps(data, indent=2)}")
except Exception as e:
    print(f"Error: {e}")
