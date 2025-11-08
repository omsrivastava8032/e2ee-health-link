import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use neutral names for Edge Function secrets because dashboard disallows SUPABASE_* prefix
    const supabaseUrl = Deno.env.get('PROJECT_URL')!;
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { patientId, data, hash } = await req.json();

    if (!patientId || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: patientId and data' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Received vitals for patient ${patientId}`);

    // Verify integrity hash if provided
    let isTampered = false;
    if (hash) {
      // Note: We can't verify the hash here because we don't decrypt the data
      // The hash verification happens on the client side after decryption
      // For now, we store the hash and mark as potentially tampered if hash is missing
      // The frontend will verify the hash after decryption
    } else {
      // If no hash provided, mark as potentially tampered
      isTampered = true;
      console.warn(`⚠️ No hash provided for patient ${patientId} - marking as potentially tampered`);
    }

    // Store encrypted data with tamper detection flag
    const { error: insertError } = await supabase
      .from('vitals')
      .insert({
        patient_id: patientId,
        encrypted_data: data,
        data_hash: hash || null,
        is_tampered: isTampered,
      });

    if (insertError) {
      console.error('Database error:', insertError);
      throw insertError;
    }

    console.log(`Successfully stored vitals for patient ${patientId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Vitals stored successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error processing vitals:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
