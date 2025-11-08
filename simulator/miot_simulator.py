#!/usr/bin/env python3
"""
MIoT Attack Simulator (Dataset-Driven)
Reads from a CSV dataset and sends data in sets of 10.
Intentionally tampers with one entry in each set to simulate a MITM attack.
"""

import json
import time
import random
import base64
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os
import pandas as pd  # NEW import

# --- CONFIGURATION ---
API_ENDPOINT = "https://xypxadidbfankltjojdm.supabase.co/functions/v1/vitals-api"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cHhhZGlkYmZhbmtsdGpvamRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMjE3OTEsImV4cCI6MjA3Nzg5Nzc5MX0.rHUf01T7OL6Vx8V3sRygXhMRm6L2wK7uI7mpIF5S2ck"
PATIENT_ID = "p123"
ENCRYPTION_KEY = b"bSYgISDhzMjkeb22DO3Oxk0KDA8qSIrYGYAiM7Ax08A="
INTERVAL_SECONDS = 2  # Time between each reading
SET_SIZE = 10         # Send 10 readings in a set
ATTACK_INDEX = 5      # Attack the 5th item in every set
# Use the new dataset file you uploaded
DATASET_FILE = os.path.join(os.path.dirname(__file__), 'patients_data_with_alerts.xlsx - Sheet1.csv')

def pad_key(key: bytes) -> bytes:
    """Ensure key is exactly 32 bytes"""
    if len(key) < 32:
        return key + b'0' * (32 - len(key))
    return key[:32]

def encrypt_data(data: str, key: bytes) -> str:
    """Encrypt data using AES-256-GCM"""
    key = pad_key(key)
    iv = os.urandom(12)
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(data.encode()) + encryptor.finalize()
    combined = iv + ciphertext + encryptor.tag
    return base64.b64encode(combined).decode()

def send_vitals(encrypted_data: str, patient_id: str, is_attack: bool) -> bool:
    """Send encrypted vitals to the API"""
    try:
        payload = {"patientId": patient_id, "data": encrypted_data}
        headers = {"Content-Type": "application/json", "apikey": API_KEY}
        
        response = requests.post(API_ENDPOINT, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            if is_attack:
                print(f"  -> ATTACK: Sent MALICIOUS payload for patient {patient_id}")
            else:
                print(f"  -> VALID: Sent payload for patient {patient_id}")
            return True
        else:
            print(f"  -> FAILED to send: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"  -> FAILED to send: {e}")
        return False

def main():
    """Main simulator loop"""
    print("=" * 60)
    print("MIoT ATTACK Simulator (MITM Data Tampering)")
    print("=" * 60)
    
    try:
        print(f"Loading dataset from: {DATASET_FILE}")
        df = pd.read_csv(DATASET_FILE)
        # We only need these columns. Rename them to match our JSON.
        df = df[['Heart Rate (bpm)', 'SpO2 Level (%)', 'Body Temperature (°C)']].rename(columns={
            'Heart Rate (bpm)': 'heartRate',
            'SpO2 Level (%)': 'spo2',
            'Body Temperature (°C)': 'temp'
        }).dropna() # Drop rows with missing data
        print(f"Successfully loaded {len(df)} records.")
    except FileNotFoundError:
        print(f"✗ ERROR: Cannot find dataset file: {DATASET_FILE}")
        print("Please make sure 'patients_data_with_alerts.xlsx - Sheet1.csv' is in the 'simulator' folder.")
        return
    except KeyError:
        print("✗ ERROR: Dataset columns do not match.")
        print("Please ensure the CSV has columns: 'Heart Rate (bpm)', 'SpO2 Level (%)', 'Body Temperature (°C)'")
        return
    except Exception as e:
        print(f"✗ ERROR: Could not read dataset: {e}")
        return

    print(f"Patient ID: {PATIENT_ID}")
    print(f"Sending data in sets of {SET_SIZE}...")
    print(f"One entry in each set (index {ATTACK_INDEX}) will be tampered with.")
    print("=" * 60)
    print("\nStarting simulation (Press Ctrl+C to stop)...\n")
    
    try:
        # Loop through the dataset in chunks (sets) of 10
        for i in range(0, len(df) - SET_SIZE, SET_SIZE):
            print(f"\n--- Sending Set {i // SET_SIZE + 1} ---")
            
            data_set = df.iloc[i : i + SET_SIZE]
            
            for j, row in enumerate(data_set.to_dict('records')):
                # Clean up data just in case
                vitals = {
                    "heartRate": int(row['heartRate']),
                    "spo2": int(row['spo2']),
                    "temp": round(float(row['temp']), 1)
                }
                
                is_attack = (j == ATTACK_INDEX - 1) # Attack the 5th item (index 4)
                
                print(f"Entry {j+1}/{SET_SIZE}: {vitals}")
                
                vitals_json = json.dumps(vitals)
                encrypted = encrypt_data(vitals_json, ENCRYPTION_KEY)
                
                if is_attack:
                    # --- THIS IS THE ATTACKER CODE ---
                    print("  -> SIMULATING ATTACK: Tampering with encrypted data...")
                    tampered_data_list = list(encrypted)
                    idx_to_tamper = len(tampered_data_list) // 2
                    tampered_data_list[idx_to_tamper] = 'X' # Flip a bit
                    encrypted = "".join(tampered_data_list)
                    # ---------------------------------
                
                send_vitals(encrypted, PATIENT_ID, is_attack)
                time.sleep(INTERVAL_SECONDS) # Wait between each send
                
            print("--- Set complete ---")
        print("\nAll data from dataset sent.")
            
    except KeyboardInterrupt:
        print("\n\n✓ Simulator stopped")

if __name__ == "__main__":
    if not API_KEY:
        print("\n⚠️  Please configure the API_KEY in the script first!")
        exit(1)
    main()
