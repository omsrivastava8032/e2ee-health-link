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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { patientId, data } = await req.json();

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

    // Store encrypted data directly (no decryption on server)
    const { error: insertError } = await supabase
      .from('vitals')
      .insert({
        patient_id: patientId,
        encrypted_data: data, // Store encrypted data as-is
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
