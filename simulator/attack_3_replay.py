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
print("Running Attack 3: Replay Attack")
print("This will send one valid packet, then replay it 10 times.")
print("=" * 60)

def sign_payload(payload_json: str, secret: str) -> str:
    key = secret.encode()
    message = payload_json.encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()

try:
    # 1. Create one valid payload and signature
    vitals_payload = {"heartRate": 75, "spo2": 97, "temp": 36.8}
    current_time_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    full_payload = {
        "patientId": PATIENT_ID,
        "timestamp": current_time_iso,
        "vitals": vitals_payload,
        "deviceId": "dev_001",
        "token": hashlib.sha256(("super_secret_123" + (lambda g: f"{g.tm_year}-{g.tm_mon:02d}-{g.tm_mday:02d}-{g.tm_hour:02d}-{g.tm_min:02d}")(time.gmtime())).encode()).hexdigest()
    }
    payload_json = json.dumps(full_payload, separators=(',', ':'))
    signature = sign_payload(payload_json, HMAC_SECRET)
    
    headers = {
        "Content-Type": "application/json",
        "apikey": API_KEY,
        "Authorization": f"Bearer {API_KEY}",
        "X-Signature": signature
    }
    
    print(f"Capturing one valid packet:\n{payload_json}\nSignature: {signature}\n")
    
    # 2. Send the packet 11 times
    for i in range(11):
        print(f"Sending packet (Attempt {i+1}/11)...")
        response = requests.post(API_ENDPOINT, data=payload_json, headers=headers)
        
        if i == 0:
            print(f"  -> VALID: First packet accepted (Status {response.status_code})")
            print("  -> Server has now logged this timestamp.")
        else:
            if response.status_code == 403:
                print(f"  -> REJECTED: Server rejected packet (Status {response.status_code}) - {response.text}")
            else:
                print(f"  -> FAILED: Server responded with {response.status_code} - {response.text}")
        
        if i == 1:
             print("\n--- ATTACK DETECTED! ---")
             print("Success! Server is rejecting the replayed packet.")
             print("Check the dashboard 'Security & Anomaly Log' to see the alerts.")
        
        time.sleep(1)

except Exception as e:
    print(f"\nError: {e}")
    