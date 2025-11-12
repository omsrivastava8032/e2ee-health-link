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
print("Running Attack 1: Message Modification (Bad Signature)")
print("=" * 60)

try:
    # 1. Create a valid payload
    vitals_payload = {"heartRate": 150, "spo2": 90, "temp": 38.0} # Malicious data
    full_payload = {
        "patientId": PATIENT_ID,
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "vitals": vitals_payload
    }
    payload_json = json.dumps(full_payload, separators=(',', ':'))
    
    # 2. THIS IS THE ATTACK: Send a BAD signature
    signature = "this-is-a-fake-signature-12345"
    
    print(f"Sending payload: {payload_json}")
    print(f"Sending BAD signature: {signature}")

    headers = {
        "Content-Type": "application/json",
        "apikey": API_KEY,
        "Authorization": f"Bearer {API_KEY}",
        "X-Signature": signature
    }
    
    response = requests.post(API_ENDPOINT, data=payload_json, headers=headers)
    
    if response.status_code == 403:
        print("\n--- ATTACK DETECTED! ---")
        print(f"Success! Server rejected our payload with status 403.")
        print(f"Response: {response.text}")
        print("Check the dashboard 'Security & Anomaly Log' to see the alert.")
    else:
        print(f"\nAttack failed? Server responded with: {response.status_code}")
        print(f"Response: {response.text}")

except Exception as e:
    print(f"Error: {e}")