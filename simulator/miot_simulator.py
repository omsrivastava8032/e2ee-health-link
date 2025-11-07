#!/usr/bin/env python3
"""
MIoT Device Simulator
Simulates a medical IoT device sending encrypted patient vitals
"""

import json
import time
import random
import base64
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os

# Configuration
API_ENDPOINT = "https://xypxadidbfankltjojdm.supabase.co/functions/v1/vitals-api"

# ADD YOUR API KEY HERE
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cHhhZGlkYmZhbmtsdGpvamRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMjE3OTEsImV4cCI6MjA3Nzg5Nzc5MX0.rHUf01T7OL6Vx8V3sRygXhMRm6L2wK7uI7mpIF5S2ck"

# Device will cycle among these patient IDs
PATIENT_IDS = ["123", "124", "125"]
ENCRYPTION_KEY = b"bSYgISDhzMjkeb22DO3Oxk0KDA8qSIrYGYAiM7Ax08A="  # Must match client key
INTERVAL_SECONDS = 2

def pad_key(key: bytes) -> bytes:
    """Ensure key is exactly 32 bytes"""
    if len(key) < 32:
        return key + b'0' * (32 - len(key))
    return key[:32]

def encrypt_data(data: str, key: bytes) -> str:
    """Encrypt data using AES-256-GCM"""
    key = pad_key(key)

    # Generate random IV
    iv = os.urandom(12)

    # Create cipher
    cipher = Cipher(
        algorithms.AES(key),
        modes.GCM(iv),
        backend=default_backend()
    )
    encryptor = cipher.encryptor()

    # Encrypt
    ciphertext = encryptor.update(data.encode()) + encryptor.finalize()

    # Combine IV + ciphertext + tag
    combined = iv + ciphertext + encryptor.tag

    # Return as base64
    return base64.b64encode(combined).decode()

def generate_vitals() -> dict:
    """Generate random but realistic vital signs"""
    return {
        "heartRate": random.randint(60, 100),
        "spo2": random.randint(95, 100),
        "temp": round(random.uniform(36.0, 37.5), 1)
    }

def send_vitals(encrypted_data: str, patient_id: str) -> bool:
    """Send encrypted vitals to the API"""
    try:
        payload = {
            "patientId": patient_id,
            "data": encrypted_data
        }

        # Create headers with the API key
        headers = {
            "Content-Type": "application/json",
            "apikey": API_KEY
        }

        response = requests.post(
            API_ENDPOINT,
            json=payload,
            headers=headers,  # Use the headers
            timeout=10
        )

        if response.status_code == 200:
            print(f"✓ Vitals sent successfully for patient {patient_id}")
            return True
        else:
            print(f"✗ Failed to send vitals: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        print(f"✗ Error sending vitals: {e}")
        return False

def main():
    """Main simulator loop"""
    print("=" * 60)
    print("MIoT Device Simulator")
    print("=" * 60)
    print(f"Patient IDs (rotating): {', '.join(PATIENT_IDS)}")
    print(f"API Endpoint: {API_ENDPOINT}")
    print(f"Interval: {INTERVAL_SECONDS} seconds")
    print("=" * 60)
    print("\nStarting simulation (Press Ctrl+C to stop)...\n")

    try:
        patient_index = 0
        while True:
            # Rotate through patients sequentially for consistent updates
            patient_id = PATIENT_IDS[patient_index]
            patient_index = (patient_index + 1) % len(PATIENT_IDS)
            vitals = generate_vitals()
            print(f"\nGenerated vitals: {vitals}")

            # Encrypt vitals
            vitals_json = json.dumps(vitals)
            encrypted = encrypt_data(vitals_json, ENCRYPTION_KEY)
            print(f"Encrypted: {encrypted[:50]}...")

            # Send to API
            send_vitals(encrypted, patient_id)

            # Wait for next iteration
            time.sleep(INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print("\n\n✓ Simulator stopped")

if __name__ == "__main__":
    # Updated check: Ensure the key is present
    if not API_KEY:
        print("\n⚠️  Please configure the API_KEY in the script first!")
        exit(1)

    main()
