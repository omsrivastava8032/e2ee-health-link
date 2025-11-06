# MIoT Device Simulator

This Python script simulates a Medical IoT (MIoT) device that sends encrypted patient vitals to the backend API.

## Features

- Generates realistic vital signs (heart rate, SpO2, temperature)
- Encrypts data using AES-256-GCM before transmission
- Sends encrypted data to the backend API
- Runs continuously, sending vitals at regular intervals

## Setup

1. **Install Python dependencies:**

```bash
pip install -r requirements.txt
```

2. **Configure the simulator:**

Edit `miot_simulator.py` and update these variables:

```python
API_ENDPOINT = "YOUR_SUPABASE_URL/functions/v1/vitals-api"
PATIENT_ID = "p123"  # Change to your patient ID
ENCRYPTION_KEY = b"your-32-byte-encryption-key-here!"  # Must match the key in src/lib/crypto.ts
INTERVAL_SECONDS = 5  # How often to send vitals
```

**IMPORTANT:** The `ENCRYPTION_KEY` must be exactly the same as the one used in the web application (`src/lib/crypto.ts`) for decryption to work.

3. **Run the simulator:**

```bash
python miot_simulator.py
```

## Output

The simulator will:
- Generate random but realistic vitals every few seconds
- Encrypt the data
- Send it to your backend API
- Print status messages showing success/failure

Example output:
```
Generated vitals: {'heartRate': 75, 'spo2': 98, 'temp': 36.8}
Encrypted: YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo...
✓ Vitals sent successfully for patient p123
```

## Security Notes

- The encryption key should be stored securely in production (e.g., environment variables, key management service)
- This simulator is for development and testing purposes
- In production, MIoT devices should use secure hardware modules for key storage
- The API endpoint should be properly secured with authentication in production

## Stopping the Simulator

Press `Ctrl+C` to stop the simulator gracefully.
