import urllib.request
import json

url = "http://localhost:3000/api/owner/register"
payload = {
    "ownerEmail": "adr23cs010@cea.ac.in",
    "name": "Test Restaurant 123",
    "cuisine": "Indian",
    "dietary": "Both",
    "serviceMode": "Dine-in",
    "rating": 4.5,
    "facilities": ["AC"],
    "gmapLink": "https://www.google.com/maps/@12.9716,77.5946,15z",
    "budget": 1000,
    "chef": {"name": "Test Chef", "exp": 10}
}

data = json.dumps(payload).encode('utf-8')
headers = {'Content-Type': 'application/json'}
req = urllib.request.Request(url, data=data, headers=headers)

try:
    print("Attempting to register...")
    with urllib.request.urlopen(req, timeout=10) as f:
        print(f"Status: {f.status}")
        print(f"Response: {f.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(f"Body: {e.read().decode('utf-8')}")
