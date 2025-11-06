# MIoT Vitals Dashboard - Deployment Guide

## Pre-Deployment Checklist

### 1. Security Configuration

**CRITICAL: Update Encryption Keys**
- [ ] Change the encryption key in `src/lib/crypto.ts`
- [ ] Update the encryption key in `simulator/miot_simulator.py` to match
- [ ] Store the encryption key securely (use environment variables in production)

```typescript
// src/lib/crypto.ts
// Replace with a secure 32-byte key generated using:
// node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
const ENCRYPTION_KEY = "YOUR-SECURE-32-BYTE-KEY-HERE";
```

### 2. Database & Authentication

✅ Database tables created with RLS policies
✅ Authentication configured with auto-confirm for development
- [ ] For production: Disable auto-confirm and configure email provider
- [ ] Review and adjust RLS policies if needed
- [ ] Set up proper authentication redirect URLs

### 3. Edge Function Configuration

✅ `vitals-api` edge function created
- [ ] Update API endpoint in simulator: `simulator/miot_simulator.py`
- [ ] Configure any rate limiting if needed
- [ ] Set up monitoring and logging

### 4. Frontend Deployment

The app is ready to deploy via Lovable's Publish button:

1. Click **Publish** (top right on desktop, bottom-right in Preview mode)
2. Review your changes
3. Click **Update** to deploy frontend changes

**Note:** Backend changes (edge functions, database migrations) deploy automatically!

### 5. Configure Simulator

After deployment, update the simulator with your production URL:

```python
# simulator/miot_simulator.py
API_ENDPOINT = "https://YOUR-PROJECT-URL.supabase.co/functions/v1/vitals-api"
PATIENT_ID = "p123"
ENCRYPTION_KEY = b"YOUR-SECURE-32-BYTE-KEY-HERE!"
```

Run the simulator:
```bash
cd simulator
pip install -r requirements.txt
python miot_simulator.py
```

## System Architecture

### Authentication Flow
1. User signs up/logs in → `Auth.tsx`
2. If 2FA enabled → `Verify2FA.tsx`
3. Access granted → `Dashboard.tsx`

### Data Flow
1. MIoT device encrypts vitals (AES-256-GCM)
2. Device sends to `/functions/v1/vitals-api`
3. Backend stores encrypted data (never decrypts)
4. Frontend fetches encrypted data
5. Frontend decrypts and displays vitals

### Security Features
- ✅ End-to-end encryption (E2EE)
- ✅ Two-factor authentication (TOTP)
- ✅ Row-level security policies
- ✅ Secure session management
- ✅ HTTPS-only communication

## Production Recommendations

### 1. Environment Variables
Move all secrets to environment variables:
- Encryption keys
- API endpoints
- Feature flags

### 2. Email Provider
Configure a production email provider for:
- Email verification
- Password reset
- 2FA backup codes

### 3. Monitoring
Set up monitoring for:
- API response times
- Failed authentication attempts
- Decryption errors
- Database performance

### 4. Rate Limiting
Implement rate limiting on:
- Authentication endpoints
- Vitals API endpoint
- 2FA verification

### 5. Backup & Recovery
- Regular database backups
- Encryption key recovery plan
- Disaster recovery procedures

## Testing Before Production

1. **Test Authentication:**
   - Sign up new user
   - Enable 2FA
   - Test 2FA login flow
   - Test logout

2. **Test Vitals Flow:**
   - Run simulator
   - Verify data appears in dashboard
   - Check decryption works correctly
   - Download vitals to file

3. **Test Security:**
   - Verify RLS policies
   - Test unauthorized access attempts
   - Check encryption/decryption

## Support & Documentation

- Main docs: https://docs.lovable.dev/
- Cloud features: https://docs.lovable.dev/features/cloud
- Troubleshooting: https://docs.lovable.dev/tips-tricks/troubleshooting

## Key Files Reference

- **Frontend Pages:**
  - `src/pages/Index.tsx` - Landing page
  - `src/pages/Auth.tsx` - Login/signup
  - `src/pages/Verify2FA.tsx` - 2FA verification
  - `src/pages/Dashboard.tsx` - Main vitals dashboard
  - `src/pages/Profile.tsx` - User settings & 2FA setup

- **Backend:**
  - `supabase/functions/vitals-api/index.ts` - API endpoint
  - Database migrations already applied

- **Utilities:**
  - `src/lib/crypto.ts` - Encryption/decryption
  - `src/lib/totp.ts` - 2FA TOTP implementation
  - `simulator/` - MIoT device simulator
