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
import urllib.request
import re

# Email configuration (Optional fallback to console)
EMAIL_SENDER = "adarsh895j@gmail.com"
EMAIL_PASSWORD = "iwxk zrpi dcyt avxt"
verification_codes = {}
last_otp_sent = {} # email -> timestamp

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
                print(f"[DB ERROR] Failed to parse {filename}: {e}")
                return default
    return default

def save_json(filename, data):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"[DB] Saved {filename} ({len(data)} items)")
    except Exception as e:
        print(f"[DB ERROR] Failed to save {filename}: {e}")

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
        
        print(f"[POST] {parsed_path.path}")
        
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
            elif parsed_path.path == '/api/admin/reject':
                self.handle_admin_reject(body)
            elif parsed_path.path == '/api/admin/list_pending':
                self.handle_admin_list_pending()
            elif parsed_path.path == '/api/admin/list_partners':
                self.handle_admin_list_partners()
            elif parsed_path.path == '/api/admin/approve_dish':
                self.handle_admin_approve_dish(body)
            elif parsed_path.path == '/api/user/add_history':
                self.handle_add_history(body)
            elif parsed_path.path == '/api/user/get_history':
                self.handle_get_history(body)
            elif parsed_path.path == '/api/restaurant/add_review':
                self.handle_add_review(body)
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
        
        # Final self-healing check: if any approved restaurant is missing coordinates, try to fix it now
        re_save = False
        for r in restaurants:
            if r.get('status') == 'approved' and (r.get('lat') is None or r.get('lng') is None):
                link = r.get('gmapLink', '')
                if link:
                    print(f"[SELF-HEAL] Attempting to resolve coords for: {r.get('name')}")
                    coords = self.extract_coords_from_gmap(link)
                    if coords:
                        r['lat'] = coords['lat']
                        r['lng'] = coords['lng']
                        re_save = True
        
        if re_save:
            save_json(DB_FILE, restaurants)
            # Re-filter results to include newly fixed coordinates
            results = [r for r in restaurants if r.get('status') != 'pending']
            if cuisine and cuisine != 'Any':
                results = [r for r in results if r.get('cuisine', '').lower() == cuisine.lower()]

        # Mapping for frontend consistency
        merged_results = []
        for r in results:
            mapped = dict(r)
            if 'lat' not in mapped or mapped['lat'] is None: mapped['lat'] = 0.0
            if 'lng' not in mapped or mapped['lng'] is None: mapped['lng'] = 0.0
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
        otp = body.get('otp')
        
        users_data = load_json(USER_FILE, {"users": []})
        user = next((u for u in users_data["users"] if u["email"] == email and u["password"] == password), None)
        
        if user:
            # If creds correct but no OTP provided, trigger 2FA
            if not otp:
                code = str(random.randint(100000, 999999))
                verification_codes[email] = {"code": code, "expiry": time.time() + 600}
                self._send_otp_to_email(email, code)
                return self.respond(200, {"success": True, "otp_required": True, "message": "OTP sent to your email! (Check console if local)"})
            
            # Verify OTP
            if email in verification_codes:
                saved = verification_codes[email]
                if saved['code'] == str(otp) and time.time() < saved['expiry']:
                    del verification_codes[email]
                    response = dict(user)
                    if "password" in response: del response["password"]
                    return self.respond(200, {"success": True, "user": response})
                else:
                    return self.respond(401, {"success": False, "message": "Invalid or expired OTP."})
            else:
                return self.respond(401, {"success": False, "message": "Session expired. Please sign in again."})
        else:
            self.send_response(401)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "Invalid password or email."}).encode('utf-8'))

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
        
        # Extract coords from gmapLink if provided
        gmap_link = body.get('gmapLink', '')
        extracted_coords = self.extract_coords_from_gmap(gmap_link)
        
        if extracted_coords:
            body['lat'] = extracted_coords['lat']
            body['lng'] = extracted_coords['lng']
        
        # If still missing or null, use a reasonable random fallback (Kerala region)
        if body.get('lat') is None or body.get('lng') is None:
            # Pushed default to Kerala area where users seem to be (Adoor/Kerala)
            body['lat'] = 9.15 + (random.random() - 0.5) * 0.05
            body['lng'] = 76.73 + (random.random() - 0.5) * 0.05
            
        restaurants.append(body)
        save_json(DB_FILE, restaurants)
        print(f"[OWNER] Registered new restaurant: {body.get('name')} (ID: {new_id}, Status: pending)")
        
        users_data = load_json(USER_FILE, {"users": []})
        for u in users_data["users"]:
            if u["email"] == body.get('ownerEmail'):
                u['restaurantId'] = new_id
                break
        save_json(USER_FILE, users_data)

        self.respond(200, {"success": True, "restaurantId": new_id})

    def extract_coords_from_gmap(self, url):
        """Extract lat,lng from various Google Maps URL formats."""
        try:
            # Handle shortened links (e.g., maps.app.goo.gl)
            if "maps.app.goo.gl" in url or "goo.gl/maps" in url:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                # Follow up to 5 redirects for aggressive resolution
                for _ in range(5):
                    try:
                        with urllib.request.urlopen(req, timeout=8) as response:
                            url = response.geturl()
                            if "maps.app.goo.gl" not in url and "goo.gl/maps" not in url:
                                break
                    except: break # Stop if request fails
            
            # PRIORITIZE: !3dLat!4dLng (Specific Place Location)
            lat_match = re.search(r'!3d(-?\d+\.\d+)', url)
            lng_match = re.search(r'!4d(-?\d+\.\d+)', url)
            if lat_match and lng_match:
                return {'lat': float(lat_match.group(1)), 'lng': float(lng_match.group(2))}

            # SECONDARY: /@lat,lng,... (Map viewport center - use if no !3d)
            match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
            if match:
                return {'lat': float(match.group(1)), 'lng': float(match.group(2))}
            
            # TERTIARY: Query params (ll, q, query)
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            for p in ['ll', 'q', 'query']:
                if p in params:
                    try:
                        pts = params[p][0].split(',')
                        if len(pts) >= 2:
                            return {'lat': float(pts[0]), 'lng': float(pts[1])}
                    except: pass
            
            # QUATERNARY: General fallback regex (any lat,lng like pair)
            general_match = re.search(r'(-?\d+\.\d+),(-?\d+\.\d+)', url)
            if general_match:
                lat, lng = float(general_match.group(1)), float(general_match.group(2))
                if abs(lat) <= 90 and abs(lng) <= 180:
                    return {'lat': lat, 'lng': lng}
                
        except Exception as e:
            print(f"[MAP ERROR] Extraction failed: {e}")
        return None

    def _send_otp_to_email(self, email, code):
        """Internal helper to send OTP via email with rate limiting and console fallback."""
        now = time.time()
        # Cooldown of 10 seconds to prevent triple-sending bugs
        if email in last_otp_sent and (now - last_otp_sent[email]) < 10:
            print(f"[AUTH] Rate limiting OTP for {email} (Skipping send)")
            return True 
        
        last_otp_sent[email] = now
        print("\n" + "="*60)
        print(f"[SAVOUR] VERIFICATION OTP FOR {email}: {code}")
        print("="*60 + "\n")
        
        try:
            if not EMAIL_SENDER or not EMAIL_PASSWORD: 
                raise Exception("No SMTP config")
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'SAVOUR Verification Code'
            msg['From'] = EMAIL_SENDER
            msg['To'] = email
            
            html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ff4d4d; text-align: center;">SAVOUR</h2>
                <p>Hello,</p>
                <p>Your verification code is:</p>
                <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; border-radius: 8px; margin: 20px 0;">
                    {code}
                </div>
                <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 Savour - Premium Food Spot Recommendation</p>
            </div>
            """
            msg.attach(MIMEText(html, 'html'))
            
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
                s.login(EMAIL_SENDER, EMAIL_PASSWORD)
                s.send_message(msg)
            return True
        except Exception as e:
            print(f"[SMTP] Failed to send email to {email}: {e}")
            return False

    def handle_send_verification(self, body):
        email = body.get('email', '').strip()
        if not email: return self.respond(400, {"success": False, "message": "Email required"})
        
        code = str(random.randint(100000, 999999))
        verification_codes[email] = {"code": code, "expiry": time.time() + 600}
        
        sent = self._send_otp_to_email(email, code)
        
        if sent:
            return self.respond(200, {"success": True, "message": "Sent!"})
        else:
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
                # Final check: Resolve coordinates upon approval to ensure they exist
                if not r.get('lat') or not r.get('lng'):
                    print(f"[ADMIN] Resolving coordinates for {r.get('name')} before approval...")
                    coords = self.extract_coords_from_gmap(r.get('gmapLink', ''))
                    if coords:
                        r['lat'] = coords['lat']
                        r['lng'] = coords['lng']
                found = True
                break
        if found:
            save_json(DB_FILE, restaurants)
            return self.respond(200, {"success": True})
        self.respond(404, {"success": False, "message": "Restaurant not found"})

    def handle_admin_reject(self, body):
        res_id = str(body.get('restaurantId'))
        restaurants = load_json(DB_FILE, [])
        found = False
        for r in restaurants:
            if str(r.get('id')) == res_id:
                r['status'] = 'rejected'
                found = True
                break
        if found:
            save_json(DB_FILE, restaurants)
            return self.respond(200, {"success": True})
        self.respond(404, {"success": False, "message": "Restaurant not found"})

    def handle_admin_list_pending(self):
        restaurants = load_json(DB_FILE, [])
        pending = [r for r in restaurants if r.get('status') == 'pending']
        print(f"[ADMIN] Total entries: {len(restaurants)}, Pending found: {len(pending)}")
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(pending).encode('utf-8'))

    def handle_admin_list_partners(self):
        restaurants = load_json(DB_FILE, [])
        partners = [r for r in restaurants if r.get('status') == 'approved']
        print(f"[ADMIN] Total entries: {len(restaurants)}, Partners found: {len(partners)}")
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(partners).encode('utf-8'))
        
    def handle_admin_approve_dish(self, body):
        res_id = str(body.get('restaurantId'))
        dish_name = body.get('dishName')
        status = body.get('status', 'approved') # 'approved' or 'rejected'
        
        restaurants = load_json(DB_FILE, [])
        found = False
        for r in restaurants:
            if str(r.get('id')) == res_id:
                if 'dishes' in r:
                    for d in r['dishes']:
                        if d.get('name') == dish_name:
                            d['status'] = status
                            found = True
                            break
            if found: break
            
        if found:
            save_json(DB_FILE, restaurants)
            return self.respond(200, {"success": True})
        self.respond(404, {"success": False, "message": "Dish not found"})

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
                if dishes is not None:
                    # New dishes are pending by default, old ones maintain status
                    existing_dishes = {d['name']: d.get('status', 'approved') for d in r.get('dishes', [])}
                    new_dishes = []
                    for d in dishes:
                        d_name = d.get('name')
                        # If it's a new dish (not in existing_dishes), it's pending.
                        # If it already existed, we might want to keep its status (unless modified? for now keep status)
                        d['status'] = existing_dishes.get(d_name, 'pending')
                        new_dishes.append(d)
                    r['dishes'] = new_dishes
                    
                if name: r['name'] = name
                if cuisine: r['cuisine'] = cuisine
                if budget: r['budget'] = budget
                if chef: r['chef'] = chef
                if dietary: r['dietary'] = dietary
                if serviceMode: r['serviceMode'] = serviceMode
                if facilities is not None: r['facilities'] = facilities
                
                # Update GMaps link and re-extract coords if link changed
                gmap_link = body.get('gmapLink')
                if gmap_link:
                    r['gmapLink'] = gmap_link
                    extracted = self.extract_coords_from_gmap(gmap_link)
                    if extracted:
                        r['lat'] = extracted['lat']
                        r['lng'] = extracted['lng']
                
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

    def handle_add_review(self, body):
        res_id = str(body.get('restaurantId'))
        review = body.get('review') # { user, rating, comment, date }
        
        restaurants = load_json(DB_FILE, [])
        found = False
        for r in restaurants:
            if str(r.get('id')) == res_id:
                if 'reviews' not in r:
                    r['reviews'] = []
                r['reviews'].insert(0, review)
                found = True
                break
        
        if found:
            save_json(DB_FILE, restaurants)
            return self.respond(200, {"success": True})
        self.respond(404, {"success": False, "message": "Restaurant not found"})

socketserver.TCPServer.allow_reuse_address = True

try:
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        print(f"Server running on http://localhost:{PORT}")
        httpd.serve_forever()
except OSError as e:
    if e.errno == 10048:
        print(f"Error: Port {PORT} is already in use.")
        print("Please stop any other running instances of the server or use a different port.")
    else:
        raise e
