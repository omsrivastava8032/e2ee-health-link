// TOTP (Time-based One-Time Password) implementation for 2FA

export function generateTOTPSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < 20; i++) {
    secret += chars[array[i] % chars.length];
  }
  
  return secret;
}

function base32Decode(encoded: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  
  for (const char of encoded.toUpperCase()) {
    const index = chars.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  
  return bytes;
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  // Convert Uint8Array to proper ArrayBuffer for TypeScript 5.7 compatibility
  const keyBuffer = new ArrayBuffer(key.length);
  const keyView = new Uint8Array(keyBuffer);
  keyView.set(key);
  
  const messageBuffer = new ArrayBuffer(message.length);
  const messageView = new Uint8Array(messageBuffer);
  messageView.set(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageBuffer);
  return new Uint8Array(signature);
}

async function generateTOTP(secret: string, timeStep: number = 30): Promise<string> {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / timeStep);
  
  const timeBytes = new Uint8Array(8);
  let timeValue = time;
  for (let i = 7; i >= 0; i--) {
    timeBytes[i] = timeValue & 0xff;
    timeValue >>= 8;
  }
  
  const hmac = await hmacSha1(key, timeBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, "0");
}

export async function verifyTOTP(token: string, secret: string, window: number = 1): Promise<boolean> {
  for (let i = -window; i <= window; i++) {
    const timeStep = 30;
    const epoch = Math.floor(Date.now() / 1000);
    const time = Math.floor(epoch / timeStep) + i;
    
    const key = base32Decode(secret);
    const timeBytes = new Uint8Array(8);
    let t = time;
    for (let j = 7; j >= 0; j--) {
      timeBytes[j] = t & 0xff;
      t = Math.floor(t / 256);
    }
    
    const hmac = await hmacSha1(key, timeBytes);
    const offset = hmac[hmac.length - 1] & 0x0f;
    
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1000000;
    
    const expectedToken = code.toString().padStart(6, "0");
    
    if (token === expectedToken) {
      return true;
    }
  }
  
  return false;
}

export function generateQRCodeURL(secret: string, email: string, issuer: string = "MIoT Vitals"): string {
  const otpauthURL = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthURL)}`;
}
