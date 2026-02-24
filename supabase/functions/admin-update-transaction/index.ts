import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactionId, tableName, updates, adminId, targetUserId } = await req.json();

    if (!transactionId || !tableName || !updates || !adminId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service_role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify admin role
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminId)
      .eq('role', 'admin')
      .single();

    if (roleError || !adminRole) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the update object based on which table we're updating
    let updateData: Record<string, any> = {};

    if (tableName === 'transfers') {
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.recipient !== undefined) updateData.recipient_name = updates.recipient;
      if (updates.created_at !== undefined) updateData.created_at = updates.created_at;
      if (updates.status !== undefined) updateData.status = updates.status;
    } else {
      // transactions table
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.recipient !== undefined) updateData.recipient = updates.recipient;
      if (updates.created_at !== undefined) updateData.created_at = updates.created_at;
      if (updates.status !== undefined) updateData.status = updates.status;
    }

    // Perform the update using service_role to bypass RLS
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from(tableName)
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating transaction:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update transaction", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the admin action
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action_type: 'edit_transaction',
      target_user_id: targetUserId,
      details: {
        transaction_id: transactionId,
        source_table: tableName,
        changes: updates
      }
    });

    console.log(`Transaction ${transactionId} updated successfully in ${tableName}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Transaction updated successfully",
        record: updatedRecord
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in admin-update-transaction function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
