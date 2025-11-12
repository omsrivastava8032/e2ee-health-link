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

print("=" * 60)
print("Running Advanced Attack 1: Message Modification")
print("Sends 1 VALID packet, then 1 MALICIOUS (tampered) packet.")
print("=" * 60)

def sign_payload(payload_json: str, secret: str) -> str:
    key = secret.encode()
    message = payload_json.encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()

try:
    # 1. Load the dataset to get one valid row
    try:
        df = pd.read_excel(DATASET_FILE)
        df = df[['Heart Rate (bpm)', 'SpO2 Level (%)', 'Body Temperature (°C)']].rename(columns={
            'Heart Rate (bpm)': 'heartRate', 'SpO2 Level (%)': 'spo2', 'Body Temperature (°C)': 'temp'
        }).dropna()
        print(f"Loaded {len(df)} records from dataset.")
    except Exception as e:
        print(f"✗ ERROR: Could not read dataset: {e}")
        exit()

    # --- 2. Send 1 VALID Packet ---
    print("\n[Phase 1: Sending VALID packet to appear normal]")
    valid_row = df.iloc[0].to_dict()
    vitals_valid = {"heartRate": int(valid_row['heartRate']), "spo2": int(valid_row['spo2']), "temp": round(float(valid_row['temp']), 1)}
    
    valid_payload_obj = {
        "patientId": PATIENT_ID,
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "vitals": vitals_valid
    }
    valid_payload_json = json.dumps(valid_payload_obj, separators=(',', ':'))
    valid_signature = sign_payload(valid_payload_json, HMAC_SECRET)
    
    headers_valid = {
        "Content-Type": "application/json",
        "apikey": API_KEY,
        "Authorization": f"Bearer {API_KEY}",
        "X-Signature": valid_signature
    }
    
    response_valid = requests.post(API_ENDPOINT, data=valid_payload_json, headers=headers_valid)
    print(f"  -> Sent VALID: {valid_payload_json}")
    print(f"  -> Status: {response_valid.status_code} (Should be 200)")
    
    print("\nWaiting 5 seconds...")
    time.sleep(5)

    # --- 3. Send 1 MALICIOUS Packet ---
    print("[Phase 2: Sending MALICIOUS (tampered) packet]")
    
    # Create a payload with dangerous vitals
    vitals_malicious = {"heartRate": 999, "spo2": 0, "temp": 99.0} # Malicious data
    
    malicious_payload_obj = {
        "patientId": PATIENT_ID,
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "vitals": vitals_malicious
    }
    malicious_payload_json = json.dumps(malicious_payload_obj, separators=(',', ':'))
    
    # THIS IS THE ATTACK: We create a REAL signature, then TAMPER the data
    real_signature = sign_payload(malicious_payload_json, HMAC_SECRET)
    
    # Tamper the payload *after* signing
    tampered_payload_json = malicious_payload_json.replace("999", "888") 
    
    print(f"  -> Sending TAMPERED payload: {tampered_payload_json}")
    print(f"  -> Sending ORIGINAL (now invalid) signature: {real_signature}")

    headers_malicious = {
        "Content-Type": "application/json",
        "apikey": API_KEY,
        "Authorization": f"Bearer {API_KEY}",
        "X-Signature": real_signature # This signature no longer matches the tampered data
    }
    
    response_malicious = requests.post(API_ENDPOINT, data=tampered_payload_json, headers=headers_malicious)
    
    if response_malicious.status_code == 403:
        print("\n--- ATTACK DETECTED! ---")
        print(f"Success! Server rejected our payload with status 403.")
        print(f"Response: {response_malicious.text}")
        print("Check the dashboard 'Security & Anomaly Log' to see the alert.")
    else:
        print(f"\nAttack failed? Server responded with: {response_malicious.status_code}")
        print(f"Response: {response_malicious.text}")

except Exception as e:
    print(f"Error: {e}")