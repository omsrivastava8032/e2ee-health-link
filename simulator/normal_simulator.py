import json
import time
import requests
import hmac
import hashlib
import os
import pandas as pd

API_ENDPOINT = "https://xypxadidbfankltjojdm.supabase.co/functions/v1/vitals-api"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cHhhZGlkYmZhbmtsdGpvamRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMjE3OTEsImV4cCI6MjA3Nzg5Nzc5MX0.rHUf01T7OL6Vx8V3sRygXhMRm6L2wK7uI7mpIF5S2ck"
PATIENT_ID = "p123"
HMAC_SECRET = "my-super-secret-hmac-key-12345"
DATASET_FILE = os.path.join(os.path.dirname(__file__), 'patients_data_with_alerts.xlsx')
DEVICE_ID = "dev_001"
DEVICE_SECRET = "super_secret_123"
INTERVAL_SECONDS = 3

def sign_payload(payload_json: str, secret: str) -> str:
    key = secret.encode()
    message = payload_json.encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()

def minute_key(t: float) -> str:
    g = time.gmtime(t)
    return f"{g.tm_year}-{g.tm_mon:02d}-{g.tm_mday:02d}-{g.tm_hour:02d}-{g.tm_min:02d}"

def device_token(secret: str, t: float) -> str:
    mk = minute_key(t)
    return hashlib.sha256((secret + mk).encode()).hexdigest()

def main():
    print("=" * 60)
    print("Running NORMAL Simulator (Valid Data)")
    print("=" * 60)
    
    try:
        df = pd.read_excel(DATASET_FILE)
        df = df[['Heart Rate (bpm)', 'SpO2 Level (%)', 'Body Temperature (°C)']].rename(columns={
            'Heart Rate (bpm)': 'heartRate', 'SpO2 Level (%)': 'spo2', 'Body Temperature (°C)': 'temp'
        }).dropna()
        print(f"Successfully loaded {len(df)} records.")
    except Exception as e:
        print(f"✗ ERROR: Could not read dataset: {e}")
        return

    print("\nStarting simulation (Press Ctrl+C to stop)...\n")
    
    try:
        count = 0
        for row in df.itertuples(index=False):
            count += 1
            vitals = {"heartRate": int(row.heartRate), "spo2": int(row.spo2), "temp": round(float(row.temp), 1)}
            
            # Send a unique timestamp for every request
            # This is critical to defeat the Replay Attack check
            current_time_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            
            full_payload = {
                "patientId": PATIENT_ID,
                "timestamp": current_time_iso,
                "vitals": vitals,
                "deviceId": DEVICE_ID,
                "token": device_token(DEVICE_SECRET, time.time())
            }
            payload_json = json.dumps(full_payload, separators=(',', ':'))
            signature = sign_payload(payload_json, HMAC_SECRET)
            
            headers = {
                "Content-Type": "application/json",
                "apikey": API_KEY,
                "Authorization": f"Bearer {API_KEY}",
                "X-Signature": signature
            }
            
            response = requests.post(API_ENDPOINT, data=payload_json, headers=headers, timeout=10)
            print(f"Sent reading {count}: {vitals} -> Status {response.status_code}")
            
            time.sleep(INTERVAL_SECONDS)
            
    except KeyboardInterrupt:
        print("\n\n✓ Simulator stopped")

if __name__ == "__main__":
    main()