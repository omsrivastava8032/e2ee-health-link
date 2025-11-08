#!/usr/bin/env python3
"""
Attacker Script - Intercepts and modifies vitals data during transmission
This simulates a man-in-the-middle attack that tampers with data
"""

import json
import random
import requests
from simulator.miot_simulator import (
    generate_vitals, encrypt_data, generate_hash, 
    ENCRYPTION_KEY, INTEGRITY_KEY, PATIENT_IDS, API_ENDPOINT, API_KEY
)

def tamper_data(encrypted_data: str) -> str:
    """
    Simulate attacker modifying the encrypted data
    In a real attack, this would happen during transmission
    """
    # Convert base64 to bytes, modify, then back to base64
    import base64
    data_bytes = base64.b64decode(encrypted_data)
    
    # Tamper with random bytes (simulating bit-flip attack)
    tampered_bytes = bytearray(data_bytes)
    # Flip some random bits
    for _ in range(min(10, len(tampered_bytes))):
        idx = random.randint(0, len(tampered_bytes) - 1)
        tampered_bytes[idx] ^= random.randint(1, 255)
    
    return base64.b64encode(bytes(tampered_bytes)).decode()

def send_tampered_vitals(patient_id: str, tamper_probability: float = 0.1) -> bool:
    """
    Generate vitals, encrypt, then tamper with them before sending
    tamper_probability: Chance that this transmission will be tampered (0.0 to 1.0)
    """
    try:
        # Generate legitimate vitals
        vitals = generate_vitals()
        vitals_json = json.dumps(vitals)
        
        # Encrypt normally
        encrypted = encrypt_data(vitals_json, ENCRYPTION_KEY)
        original_hash = generate_hash(vitals_json, INTEGRITY_KEY)
        
        # Attacker intercepts and decides to tamper
        should_tamper = random.random() < tamper_probability
        
        if should_tamper:
            print(f"🔴 ATTACKER: Tampering with data for patient {patient_id}!")
            # Tamper with the encrypted data
            tampered_encrypted = tamper_data(encrypted)
            # Send WITHOUT hash (or with wrong hash) to simulate attack
            payload = {
                "patientId": patient_id,
                "data": tampered_encrypted,
                # Intentionally omit hash or send wrong hash
            }
            print(f"   Original hash: {original_hash[:20]}...")
            print(f"   Sent WITHOUT hash (tampered data)")
        else:
            # Send legitimate data with hash
            payload = {
                "patientId": patient_id,
                "data": encrypted,
                "hash": original_hash
            }
        
        headers = {
            "Content-Type": "application/json",
            "apikey": API_KEY
        }
        
        response = requests.post(
            API_ENDPOINT,
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            status = "🔴 TAMPERED" if should_tamper else "✓ Valid"
            print(f"{status} - Vitals sent for patient {patient_id}")
            return True
        else:
            print(f"✗ Failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def main():
    """Run attacker simulation"""
    print("=" * 60)
    print("🔴 ATTACKER SIMULATION")
    print("=" * 60)
    print("This script simulates a man-in-the-middle attack")
    print("It will tamper with ~10% of transmissions")
    print("=" * 60)
    print("\nStarting attack simulation (Press Ctrl+C to stop)...\n")
    
    import time
    patient_index = 0
    
    try:
        while True:
            patient_id = PATIENT_IDS[patient_index]
            patient_index = (patient_index + 1) % len(PATIENT_IDS)
            
            send_tampered_vitals(patient_id, tamper_probability=0.1)
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\n\n✓ Attack simulation stopped")

if __name__ == "__main__":
    main()

