# MIoT Vitals Dashboard - Production Setup

## ⚠️ CRITICAL: Before Going Live

### 1. Update Encryption Key (MANDATORY)

The default encryption key MUST be changed before deployment:

**Generate a secure key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Update in two places:**

1. **Frontend** (`src/lib/crypto.ts`):
```typescript
const ENCRYPTION_KEY = "YOUR-GENERATED-KEY-HERE";
```

2. **Simulator** (`simulator/miot_simulator.py`):
```python
ENCRYPTION_KEY = b"YOUR-GENERATED-KEY-HERE"
```

> ⚠️ **Security Warning**: Keys must match exactly! Store securely and never commit to version control.

### 2. Configure Authentication

**Disable auto-confirm for production:**
- Go to Backend → Authentication → Settings
- Disable "Auto-confirm email signups"
- Configure production email provider (SMTP)

**Set up redirect URLs:**
- Add your production domain to allowed redirect URLs
- Format: `https://yourdomain.com`

### 3. Update Simulator Configuration

After deployment, update `simulator/miot_simulator.py`:

```python
# Get your URL from the Publish dialog
API_ENDPOINT = "https://YOUR-PROJECT-URL.supabase.co/functions/v1/vitals-api"
PATIENT_ID = "p123"  # Your patient ID
ENCRYPTION_KEY = b"YOUR-GENERATED-KEY-HERE"  # Match frontend key
```

### 4. Test Everything

**Authentication Test:**
1. Sign up a new account
2. Enable 2FA from profile page
3. Log out and test 2FA login
4. Verify QR code scan works

**Data Flow Test:**
1. Start simulator: `python simulator/miot_simulator.py`
2. Verify vitals appear in dashboard
3. Check decryption works correctly
4. Test download functionality

### 5. Security Review

- [ ] Encryption keys changed and secured
- [ ] Auto-confirm disabled
- [ ] Email provider configured
- [ ] Redirect URLs set correctly
- [ ] RLS policies reviewed
- [ ] Test with unauthorized access attempts

## Deploying to Production

1. **Deploy Frontend:**
   - Click **Publish** button (top-right)
   - Review changes
   - Click **Update**

2. **Backend Auto-Deploys:**
   - Edge functions deploy automatically
   - Database is already configured
   - No manual deployment needed

3. **Run Simulator:**
   ```bash
   cd simulator
   pip install -r requirements.txt
   python miot_simulator.py
   ```

## System Overview

### Architecture
```
MIoT Device → [Encrypt] → Edge Function → Database (encrypted)
                                             ↓
                            Dashboard ← [Decrypt] ← Browser
```

### Security Layers
1. **E2EE**: Data encrypted before leaving device
2. **2FA**: TOTP-based two-factor authentication
3. **RLS**: Row-level security on database
4. **HTTPS**: All communications encrypted in transit

### Data Flow
1. Device generates vitals (heartRate, spo2, temp)
2. Device encrypts with AES-256-GCM
3. Device sends to `/functions/v1/vitals-api`
4. Backend stores encrypted (never sees plaintext)
5. Frontend fetches encrypted data
6. Frontend decrypts in browser
7. User views plaintext vitals

## Production Monitoring

### What to Monitor
- Failed authentication attempts
- Decryption errors
- API response times
- Database performance
- Simulator connectivity

### Where to Check
- Console logs: Check browser developer tools
- Backend logs: Check Cloud → Edge Functions logs
- Database: Check Cloud → Database tables

## Backup & Recovery

### Critical Data
- Database (automated by Lovable Cloud)
- Encryption keys (store securely offline)
- User 2FA secrets (backup codes recommended)

### Recovery Plan
1. Database restores available in Cloud settings
2. Keep encryption key backup secure
3. Document 2FA recovery process

## Common Issues

### "Decryption failed" errors
- **Cause**: Encryption key mismatch
- **Fix**: Ensure keys match in frontend and simulator

### Simulator can't connect
- **Cause**: Wrong API endpoint
- **Fix**: Update `API_ENDPOINT` in simulator script

### 2FA not working
- **Cause**: Clock sync issue
- **Fix**: Ensure device time is accurate

### RLS policy errors
- **Cause**: User not authenticated
- **Fix**: Check authentication token validity

## Support Resources

- **Lovable Docs**: https://docs.lovable.dev/
- **Cloud Features**: https://docs.lovable.dev/features/cloud
- **Troubleshooting**: https://docs.lovable.dev/tips-tricks/troubleshooting
- **Discord Community**: Join for live support

## Production Checklist

Before going live, verify:

- [ ] ✅ All build errors resolved
- [ ] ✅ Encryption key changed from default
- [ ] ✅ Simulator configured with production URL
- [ ] ✅ Authentication tested (signup, login, 2FA)
- [ ] ✅ Email provider configured
- [ ] ✅ Auto-confirm disabled
- [ ] ✅ Vitals flow tested end-to-end
- [ ] ✅ Download functionality works
- [ ] ✅ Security review completed
- [ ] ✅ Monitoring set up
- [ ] ✅ Backup plan documented

## Next Steps

1. Complete the checklist above
2. Deploy using Publish button
3. Test with real devices
4. Monitor for issues
5. Scale as needed

Your secure MIoT dashboard is ready for production! 🚀
