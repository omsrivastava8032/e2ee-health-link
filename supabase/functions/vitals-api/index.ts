import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
// NEW: Import HMAC function
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
};

// --- Your 5-Stage Pipeline ---

// Helper function to log anomalies
async function logAnomaly(supabase: any, patientId: string, type: string, reason: string, data: any) {
  // We do NOT await this, so we can return a response to the user faster.
  // The logging will happen in the background.
  supabase.from('security_events').insert({
    patient_id: patientId,
    event_type: type,
    metadata: { reason, data }
  }).then(({ error }: { error: any }) => {
    if (error) console.error("Error logging anomaly:", error);
  });
}

// Stage 1: Session Gatekeeper (Detects Replay Attacks)
async function stage1_SessionGatekeeper(supabase: any, patientId: string, timestamp: string) {
  const { data: session, error } = await supabase
    .from('patient_sessions')
    .select('last_timestamp')
    .eq('patient_id', patientId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = 'Not found'
    throw new Error(`Database error: ${error.message}`);
  }

  const newTimestamp = new Date(timestamp);
  // Check if timestamp is valid
  if (isNaN(newTimestamp.getTime())) {
    throw new Error("Invalid timestamp format");
  }

  if (session && newTimestamp <= new Date(session.last_timestamp)) {
    // This is the detection!
    throw new Error("Replay Attack Detected: Timestamp is old or a duplicate.");
  }
}

// Stage 3: Signature & Timestamp Verification (Detects Message Modification)
async function stage3_VerifySignature(payloadString: string, signature: string, timestamp: string) {
  const HMAC_SECRET = Deno.env.get('HMAC_SECRET');
  if (!HMAC_SECRET) {
    throw new Error("HMAC_SECRET is not set in function secrets");
  }

  // Verify timestamp is recent (e.g., within 2 minutes)
  const now = new Date();
  const readingTime = new Date(timestamp);
  const diff = now.getTime() - readingTime.getTime();
  
  if (Math.abs(diff) > 120000) { // 2 minutes
    throw new Error("Replay Attack Detected: Timestamp is not recent (older than 2 minutes)");
  }

  // Verify HMAC-SHA256 signature
  const calculatedSignature = createHmac('sha256', HMAC_SECRET).update(payloadString).digest('hex');
  
  if (calculatedSignature !== signature) {
    // This is the detection!
    throw new Error("Modification of Messages Detected: Invalid Signature.");
  }
}

// Stage 2: Sanity Checks
function stage2_SanityChecks(vitals: any) {
  const { heartRate, spo2, temp } = vitals;
  if (!heartRate || heartRate < 30 || heartRate > 220) {
    throw new Error(`Sanity Check Fail: Heart Rate ${heartRate} is not plausible`);
  }
  if (!spo2 || spo2 < 70 || spo2 > 100) {
    throw new Error(`Sanity Check Fail: SpO2 ${spo2} is not plausible`);
  }
  if (!temp || temp < 32 || temp > 45) {
    throw new Error(`Sanity Check Fail: Temperature ${temp} is not plausible`);
  }
}

// Stage 5: Final Routing
async function stage5_RouteData(supabase: any, payload: any) {
  // 1. Insert the valid reading
  const { error: vitalError } = await supabase.from('vitals').insert({
    patient_id: payload.patientId,
    data: payload.vitals, // Store the plaintext vitals JSON
    timestamp: payload.timestamp
  });
  if (vitalError) throw new Error(`Failed to insert vital: ${vitalError.message}`);

  // 2. Update the session timestamp to prevent replay
  const { error: sessionError } = await supabase.from('patient_sessions').upsert({
    patient_id: payload.patientId,
    last_timestamp: payload.timestamp
  });
  if (sessionError) throw new Error(`Failed to update session: ${sessionError.message}`);
}

// --- Main Function ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let payload;
  let payloadString = "";
  let patientId = "unknown";
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  try {
    // 1. Read Data (Raw string is needed for signature)
    payloadString = await req.text();
    payload = JSON.parse(payloadString);
    const { timestamp, vitals } = payload;
    patientId = payload.patientId || "unknown"; // Get patientId for logging
    const signature = req.headers.get('X-Signature');

    if (!patientId || !timestamp || !vitals || !signature) {
      return new Response(JSON.stringify({ error: 'Missing required fields or signature' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Run the pipeline
    try {
      // Stage 1 & 3 first (Security)
      await stage1_SessionGatekeeper(supabase, patientId, timestamp);
      await stage3_VerifySignature(payloadString, signature, timestamp);
      
      // Stage 2 (Plausibility)
      stage2_SanityChecks(vitals);
      
      // Stage 5 (Routing) - All checks passed
      await stage5_RouteData(supabase, payload);

      return new Response(JSON.stringify({ success: true, message: "Data Validated and Stored" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    } catch (pipelineError) {
      // If any stage fails, log it and reject the data
      console.warn(`Pipeline rejection for ${patientId}: ${pipelineError.message}`);
      await logAnomaly(supabase, patientId, "SECURITY_ANOMALY", pipelineError.message, payload);
      return new Response(JSON.stringify({ error: pipelineError.message }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
  } catch (error) {
    // Handle DDoS (Too Many Requests) and other critical errors
    const errorMsg = error.message || "Server error";
    // Check for Supabase rate-limiting error
    const isRateLimit = errorMsg.includes("rate limit") || errorMsg.includes("Too Many Requests");
    const status = isRateLimit ? 429 : 500;
    
    if (isRateLimit) {
        console.warn(`DDoS Attack Detected: ${errorMsg}`);
        await logAnomaly(supabase, patientId, "DDOS_ATTACK_DETECTED", errorMsg, { ip: req.headers.get('x-forwarded-for') });
    } else {
        console.error('Critical function error:', errorMsg);
    }
    
    return new Response(JSON.stringify({ error: errorMsg }), { status: status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
});