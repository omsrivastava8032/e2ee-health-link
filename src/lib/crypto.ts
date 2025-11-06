// Client-side AES-256 encryption/decryption utilities
// WARNING: The encryption key should be securely stored and never exposed in production

const ENCRYPTION_KEY = "your-32-byte-encryption-key-here!"; // This should be env var in production

export async function encryptData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = encoder.encode(data);

  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedBase64: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
    
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Decode base64
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedData
    );

    return decoder.decode(decryptedData);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data");
  }
}
