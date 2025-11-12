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
print("For each reading: sends VALID packet, then TAMPERED (modified) packet.")
print("=" * 60)

def sign_payload(payload_json: str, secret: str) -> str:
    key = secret.encode()
    message = payload_json.encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()

try:
    # 1. Load the dataset
    try:
        df = pd.read_excel(DATASET_FILE)
        df = df[['Heart Rate (bpm)', 'SpO2 Level (%)', 'Body Temperature (°C)']].rename(columns={
            'Heart Rate (bpm)': 'heartRate', 'SpO2 Level (%)': 'spo2', 'Body Temperature (°C)': 'temp'
        }).dropna()
        print(f"Loaded {len(df)} records from dataset.")
    except Exception as e:
        print(f"✗ ERROR: Could not read dataset: {e}")
        exit()

    # 2. For a small batch, send VALID then TAMPERED for each row
    num_samples = min(5, len(df))
    print(f"\nSending {num_samples} pairs (VALID + TAMPERED) ...\n")
    for i in range(num_samples):
        row = df.iloc[i].to_dict()
        vitals_valid = {
            "heartRate": int(row['heartRate']),
            "spo2": int(row['spo2']),
            "temp": round(float(row['temp']), 1)
        }

        # Fresh timestamp for the valid packet so Stage 1 passes
        valid_payload_obj = {
            "patientId": PATIENT_ID,
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "vitals": vitals_valid,
            "deviceId": "dev_001",
            "token": hashlib.sha256(("super_secret_123" + (lambda g: f"{g.tm_year}-{g.tm_mon:02d}-{g.tm_mday:02d}-{g.tm_hour:02d}-{g.tm_min:02d}")(time.gmtime())).encode()).hexdigest()
        }
        valid_payload_json = json.dumps(valid_payload_obj, separators=(',', ':'))
        valid_signature = sign_payload(valid_payload_json, HMAC_SECRET)

        headers_valid = {
            "Content-Type": "application/json",
            "apikey": API_KEY,
            "Authorization": f"Bearer {API_KEY}",
            "X-Signature": valid_signature
        }
        resp_valid = requests.post(API_ENDPOINT, data=valid_payload_json, headers=headers_valid, timeout=10)
        print(f"[{i+1}] VALID -> {resp_valid.status_code}: {valid_payload_json}")

        # Build a tampered packet with a NEWER timestamp so Stage 1 (replay) passes,
        # but modify the body AFTER signing so Stage 3 (invalid signature) triggers.
        future_time_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + 1))
        original_obj = {
            "patientId": PATIENT_ID,
            "timestamp": future_time_iso,
            "vitals": vitals_valid,
            "deviceId": "dev_001",
            "token": hashlib.sha256(("super_secret_123" + (lambda g: f"{g.tm_year}-{g.tm_mon:02d}-{g.tm_mday:02d}-{g.tm_hour:02d}-{g.tm_min:02d}")(time.gmtime(time.time()+60))).encode()).hexdigest()
        }
        original_for_sig = json.dumps(original_obj, separators=(',', ':'))
        real_signature = sign_payload(original_for_sig, HMAC_SECRET)
        tampered_obj = json.loads(original_for_sig)
        tampered_obj["vitals"]["heartRate"] = tampered_obj["vitals"]["heartRate"] + 1  # minimal change
        tampered_payload_json = json.dumps(tampered_obj, separators=(',', ':'))

        headers_malicious = {
            "Content-Type": "application/json",
            "apikey": API_KEY,
            "Authorization": f"Bearer {API_KEY}",
            "X-Signature": real_signature  # now INVALID for tampered_payload_json
        }
        resp_bad = requests.post(API_ENDPOINT, data=tampered_payload_json, headers=headers_malicious, timeout=10)
        print(f"[{i+1}] TAMPERED -> {resp_bad.status_code}: {tampered_payload_json}")

        time.sleep(1)

except Exception as e:
    print(f"Error: {e}")