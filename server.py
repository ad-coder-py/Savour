import http.server
import socketserver
import json
import os
import time
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import parse_qs, urlparse

# Email configuration (Optional fallback to console)
EMAIL_SENDER = ""
EMAIL_PASSWORD = ""
verification_codes = {}

PORT = 3000
DB_FILE = "restaurants.json"
USER_FILE = "users.json"
HISTORY_FILE = "history.json"

def load_json(filename, default):
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except Exception as e:
                print(f"❌ [DB ERROR] Failed to parse {filename}: {e}")
                return default
    return default

def save_json(filename, data):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"✅ [DB] Saved {filename} ({len(data)} items)")
    except Exception as e:
        print(f"❌ [DB ERROR] Failed to save {filename}: {e}")

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        print(f"📥 [POST] {parsed_path.path}")
        
        try:
            body = json.loads(post_data.decode('utf-8')) if post_data else {}
            
            if parsed_path.path == '/api/recommend':
                self.handle_recommend(body)
            elif parsed_path.path == '/api/auth/login':
                self.handle_login(body)
            elif parsed_path.path == '/api/auth/register':
                self.handle_register(body)
            elif parsed_path.path == '/api/auth/send_verification':
                self.handle_send_verification(body)
            elif parsed_path.path == '/api/auth/verify_code':
                self.handle_verify_code(body)
            elif parsed_path.path == '/api/owner/register':
                self.handle_owner_register(body)
            elif parsed_path.path == '/api/owner/update_menu':
                self.handle_update_menu(body)
            elif parsed_path.path == '/api/owner/restaurant_info':
                self.handle_get_restaurant_info(body)
            elif parsed_path.path == '/api/admin/approve':
                self.handle_admin_approve(body)
            elif parsed_path.path == '/api/admin/list_pending':
                self.handle_admin_list_pending()
            elif parsed_path.path == '/api/user/add_history':
                self.handle_add_history(body)
            elif parsed_path.path == '/api/user/get_history':
                self.handle_get_history(body)
            else:
                self.send_error(404, "Endpoint not found")
        except Exception as e:
            print(f"Error handling POST {self.path}: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def handle_recommend(self, body):
        cuisine = body.get('cuisine')
        restaurants = load_json(DB_FILE, [])
        
        # Only show approved restaurants
        results = [r for r in restaurants if r.get('status') != 'pending']
        
        if cuisine and cuisine != 'Any':
            results = [r for r in results if r.get('cuisine', '').lower() == cuisine.lower()]
        
        # Mapping for frontend consistency
        merged_results = []
        for r in results:
            mapped = dict(r)
            if 'coords' in r:
                mapped['lat'] = r['coords'].get('lat')
                mapped['lng'] = r['coords'].get('lng')
            if 'budget' not in mapped: mapped['budget'] = 'Medium'
            if 'facilities' not in mapped: mapped['facilities'] = []
            merged_results.append(mapped)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(merged_results).encode('utf-8'))

    def handle_login(self, body):
        email = body.get('email')
        password = body.get('password')
        users_data = load_json(USER_FILE, {"users": []})
        
        user = next((u for u in users_data["users"] if u["email"] == email and u["password"] == password), None)
        
        if user:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = dict(user)
            if "password" in response: del response["password"]
            self.wfile.write(json.dumps({"success": True, "user": response}).encode('utf-8'))
        else:
            self.send_response(401)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "Invalid password or email. Use '1010' for Admin access gate."}).encode('utf-8'))

    def handle_register(self, body):
        email = body.get('email')
        users_data = load_json(USER_FILE, {"users": []})
        
        if any(u["email"] == email for u in users_data["users"]):
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "User already exists"}).encode('utf-8'))
            return

        users_data["users"].append(body)
        save_json(USER_FILE, users_data)
        
        self.send_response(201)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"success": True}).encode('utf-8'))

    def handle_owner_register(self, body):
        restaurants = load_json(DB_FILE, [])
        new_id = int(time.time())
        body['id'] = new_id
        body['status'] = 'pending'
        
        # Ensure coords exist for map sorting
        if 'lat' not in body or 'lng' not in body:
            body['lat'] = 12.9716 + (random.random() - 0.5) * 0.1
            body['lng'] = 77.5946 + (random.random() - 0.5) * 0.1
            
        restaurants.append(body)
        save_json(DB_FILE, restaurants)
        print(f"📝 [OWNER] Registered new restaurant: {body.get('name')} (ID: {new_id}, Status: pending)")
        
        users_data = load_json(USER_FILE, {"users": []})
        for u in users_data["users"]:
            if u["email"] == body.get('ownerEmail'):
                u['restaurantId'] = new_id
                break
        save_json(USER_FILE, users_data)

        self.respond(200, {"success": True, "restaurantId": new_id})

    def handle_send_verification(self, body):
        email = body.get('email', '').strip()
        if not email: return self.respond(400, {"success": False, "message": "Email required"})
        
        code = str(random.randint(100000, 999999))
        verification_codes[email] = {"code": code, "expiry": time.time() + 600}
        
        print("\n" + "="*60)
        print(f"📧 [SAVOUR] VERIFICATION OTP FOR {email}: {code}")
        print("="*60 + "\n")
        
        try:
            if not EMAIL_SENDER or not EMAIL_PASSWORD: raise Exception("No SMTP config")
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'SAVOUR Verification Code'
            msg['From'] = EMAIL_SENDER
            msg['To'] = email
            html = f"<h2>Code: {code}</h2><p>Expires in 10 mins.</p>"
            msg.attach(MIMEText(html, 'html'))
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
                s.login(EMAIL_SENDER, EMAIL_PASSWORD)
                s.send_message(msg)
            return self.respond(200, {"success": True, "message": "Sent!"})
        except:
            return self.respond(200, {"success": True, "message": "Check server terminal for code (Local Dev Mask)"})

    def handle_verify_code(self, body):
        email = body.get('email')
        code = body.get('code')
        if email in verification_codes:
            if verification_codes[email]['code'] == code and time.time() < verification_codes[email]['expiry']:
                del verification_codes[email]
                return self.respond(200, {"success": True})
        self.respond(400, {"success": False, "message": "Invalid or expired code"})

    def respond(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_admin_approve(self, body):
        res_id = str(body.get('restaurantId'))
        restaurants = load_json(DB_FILE, [])
        found = False
        for r in restaurants:
            if str(r.get('id')) == res_id:
                r['status'] = 'approved'
                found = True
                break
        if found:
            save_json(DB_FILE, restaurants)
            return self.respond(200, {"success": True})
        self.respond(404, {"success": False, "message": "Restaurant not found"})

    def handle_admin_list_pending(self):
        restaurants = load_json(DB_FILE, [])
        pending = [r for r in restaurants if r.get('status') == 'pending']
        print(f"👁️ [ADMIN] Total entries: {len(restaurants)}, Pending found: {len(pending)}")
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(pending).encode('utf-8'))

    def handle_add_history(self, body):
        email = body.get('email')
        history_item = body.get('item') # { restaurantName, dishName, date }
        history_data = load_json(HISTORY_FILE, {})
        
        if email not in history_data:
            history_data[email] = []
        
        history_data[email].insert(0, history_item) # Newest first
        history_data[email] = history_data[email][:5] # Keep last 5
        
        save_json(HISTORY_FILE, history_data)
        self.send_response(200)
        self.end_headers()

    def handle_get_history(self, body):
        email = body.get('email')
        history_data = load_json(HISTORY_FILE, {})
        user_history = history_data.get(email, [])
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(user_history).encode('utf-8'))

    def handle_update_menu(self, body):
        res_id = str(body.get('restaurantId'))
        dishes = body.get('dishes')
        name = body.get('name')
        cuisine = body.get('cuisine')
        budget = body.get('budget')
        chef = body.get('chef')
        dietary = body.get('dietary')
        serviceMode = body.get('serviceMode')
        facilities = body.get('facilities')
        
        restaurants = load_json(DB_FILE, [])
        found = False
        for r in restaurants:
            if str(r.get('id')) == res_id:
                if dishes is not None: r['dishes'] = dishes
                if name: r['name'] = name
                if cuisine: r['cuisine'] = cuisine
                if budget: r['budget'] = budget
                if chef: r['chef'] = chef
                if dietary: r['dietary'] = dietary
                if serviceMode: r['serviceMode'] = serviceMode
                if facilities is not None: r['facilities'] = facilities
                found = True
                break
        if found:
            save_json(DB_FILE, restaurants)
            return self.respond(200, {"success": True})
        self.respond(404, {"success": False, "message": "Restaurant not found"})

    def handle_get_restaurant_info(self, body):
        res_id = body.get('restaurantId')
        restaurants = load_json(DB_FILE, [])
        restaurant = next((r for r in restaurants if r.get('id') == res_id), None)
        if restaurant:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(restaurant).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    print("Server running on http://localhost:3000")
    httpd.serve_forever()
