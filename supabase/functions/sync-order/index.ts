import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sg-terminal-key, x-sg-rep-id, x-sg-manager-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Cloud Vault Secrets
const TERMINAL_SECRET_KEY =
  Deno.env.get("SG_TERMINAL_KEY") || "SG-FIELD-TERMINAL-SECURE-KEY-2026";
const MANAGER_SECRET_KEY =
  Deno.env.get("SG_MANAGER_KEY") || "SG-MANAGER-MASTER-KEY-2026";

Deno.serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Validate Authorization Tiers
    const managerKey = req.headers.get("x-sg-manager-key");
    const terminalKey = req.headers.get("x-sg-terminal-key");
    const repIdHeader = req.headers.get("x-sg-rep-id") || "";
    const authHeader = req.headers.get("authorization") || "";

    const isManager = Boolean(
      (managerKey && managerKey === MANAGER_SECRET_KEY) ||
      (authHeader && authHeader.includes(MANAGER_SECRET_KEY))
    );

    const isRep = Boolean(
      (terminalKey && terminalKey === TERMINAL_SECRET_KEY) ||
      (authHeader && authHeader.includes(TERMINAL_SECRET_KEY)) ||
      isManager
    );

    if (!isRep && !isManager) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: Invalid or missing representative terminal signature or manager key.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Initialize Elevated Admin Supabase Client using Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase internal service credentials missing on Edge runtime.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Parse Request
    const body = await req.json().catch(() => ({}));
    const { action, payload } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required action parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Restrict Manager Actions
    if (action.startsWith("manager_") && !isManager) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Manager authorization required for this action.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // FIELD REPRESENTATIVE ACTIONS (Also permitted for Manager)
    // =========================================================================

    if (action === "submit_order") {
      const order = payload;
      if (!order || !order.id || !order.buyerId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required order fields." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If submitted by field rep, ensure repId matches caller header if present
      const repId = String(order.repId || order.salespersonId || repIdHeader || "rep");
      if (!isManager && repIdHeader && repId.toLowerCase() !== repIdHeader.toLowerCase()) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: Representative ID mismatch." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Sanitize order record
      const dbOrder = {
        id: String(order.id),
        date: order.date,
        time: order.time || "",
        buyerId: String(order.buyerId),
        buyerName: String(order.buyerName || ""),
        buyerPhone: String(order.buyerPhone || ""),
        buyerTier: String(order.buyerTier || "Retail"),
        buyerHomeRoute: String(order.buyerHomeRoute || ""),
        buyerAddress: String(order.buyerAddress || ""),
        buyerGstin: String(order.buyerGstin || ""),
        repId: repId,
        repName: String(order.repName || order.salespersonName || ""),
        salespersonId: repId,
        salespersonName: String(order.salespersonName || order.repName || ""),
        dispatchRoute: String(order.dispatchRoute || ""),
        items: Array.isArray(order.items) ? order.items : [],
        totalUnits: Number(order.totalUnits || 0),
        itemsSubtotal: Number(order.itemsSubtotal || 0),
        extraRebate: Number(order.extraRebate || 0),
        netPayable: Number(order.netPayable || 0),
        paymentMode: String(order.paymentMode || "Cash on Delivery"),
        status: String(order.status || "Pending Delivery"),
        deliveredAt: order.deliveredAt ? order.deliveredAt : (order.status === "Delivered" ? new Date().toISOString() : null),
        notes: String(order.notes || ""),
      };

      // Insert order into orders table using admin client
      const { data: insertedOrder, error: orderErr } = await supabase
        .from("orders")
        .upsert([dbOrder])
        .select()
        .single();

      if (orderErr) throw orderErr;

      // Update customer ledger balance if unpaid balance exists
      const balanceDue = Number(order.balanceDue || 0);
      if (balanceDue > 0 && dbOrder.buyerId) {
        try {
          const { data: buyerData } = await supabase
            .from("buyers")
            .select("pendingUdhaar")
            .eq("id", dbOrder.buyerId)
            .maybeSingle();

          if (buyerData) {
            const currentUdhaar = Number(buyerData.pendingUdhaar || 0);
            const updatedUdhaar = currentUdhaar + balanceDue;

            await supabase
              .from("buyers")
              .update({ pendingUdhaar: updatedUdhaar })
              .eq("id", dbOrder.buyerId);
          }
        } catch (udhaarErr) {
          console.warn("Could not update buyer udhaar:", udhaarErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true, order: insertedOrder || dbOrder }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "create_customer") {
      const cust = payload;
      if (!cust || !cust.id || !cust.name) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required customer fields." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dbBuyer = {
        id: String(cust.id),
        name: String(cust.name),
        tier: String(cust.tier || "Retail"),
        phone: String(cust.phone || ""),
        homeRoute: String(cust.homeRoute || ""),
        creditLimit: Number(cust.creditLimit || 0),
        pendingUdhaar: Number(cust.pendingUdhaar || 0),
        address: String(cust.address || ""),
      };

      const { data: savedBuyer, error: buyerErr } = await supabase
        .from("buyers")
        .upsert([dbBuyer])
        .select()
        .single();

      if (buyerErr) throw buyerErr;

      return new Response(
        JSON.stringify({ success: true, customer: savedBuyer || dbBuyer }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "log_sample") {
      const sample = payload;
      if (!sample || !sample.id) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required sample fields." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dbSample = {
        id: String(sample.id),
        date: sample.date,
        time: sample.time || "",
        repId: String(sample.repId || sample.rep_id || repIdHeader || ""),
        repName: String(sample.repName || sample.rep_name || ""),
        buyerId: String(sample.buyerId || ""),
        buyerName: String(sample.buyerName || sample.store_name || ""),
        buyerPhone: String(sample.buyerPhone || ""),
        productId: String(sample.productId || ""),
        productName: String(sample.productName || sample.product_name || ""),
        sku: String(sample.sku || sample.product_sku || ""),
        qty: Number(sample.qty || sample.quantity_units || 1),
        notes: String(sample.notes || ""),
      };

      const { data: savedSample, error: sampleErr } = await supabase
        .from("sample_giveaways")
        .insert([dbSample])
        .select()
        .single();

      if (sampleErr) throw sampleErr;

      return new Response(
        JSON.stringify({ success: true, sample: savedSample || dbSample }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "log_outward") {
      const dispatch = payload;
      if (!dispatch || !dispatch.id || !dispatch.rep_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required outward dispatch fields." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dbDispatch = {
        id: String(dispatch.id),
        voucher_no: String(dispatch.voucher_no || ""),
        date: dispatch.date,
        rep_id: String(dispatch.rep_id),
        rep_name: String(dispatch.rep_name || ""),
        items: Array.isArray(dispatch.items) ? dispatch.items : [],
        total_units: Number(dispatch.total_units || 0),
        total_value: Number(dispatch.total_value || 0),
        vehicle: String(dispatch.vehicle || ""),
        notes: String(dispatch.notes || ""),
      };

      const { data: savedDispatch, error: outErr } = await supabase
        .from("inventory_outward")
        .upsert([dbDispatch])
        .select()
        .single();

      if (outErr) throw outErr;

      return new Response(
        JSON.stringify({ success: true, dispatch: savedDispatch || dbDispatch }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "fulfill_order" || action === "update_order_status") {
      const { id, status, deliveredAt, notes } = payload;
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required order id." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const newStatus = status || "Delivered";
      const updateData: any = { status: newStatus };
      updateData.deliveredAt = deliveredAt || new Date().toISOString();
      if (notes !== undefined) updateData.notes = notes;

      const { data, error } = await supabase.from("orders").update(updateData).eq("id", id).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data?.[0] || updateData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "get_bootstrap") {
      // Parallel fetch of catalog, buyers, contract pricing, orders, and outward dispatches
      const [prodsRes, buyersRes, pricingRes, ordersRes, outwardRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("buyers").select("*"),
        supabase.from("contract_pricing").select("*"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(250),
        supabase.from("inventory_outward").select("*").order("created_at", { ascending: false }).limit(250),
      ]);

      let inwardData: any[] = [];
      let routesData: any[] = [];
      let repsData: any[] = [];

      // If Manager is bootstrapping, also include full manager repository data
      if (isManager) {
        const [inwardRes, routesRes, repsRes] = await Promise.all([
          supabase.from("inventory_inward").select("*").order("created_at", { ascending: false }),
          supabase.from("routes").select("*"),
          supabase.from("salespeople").select("*"),
        ]);
        inwardData = inwardRes.data || [];
        routesData = routesRes.data || [];
        repsData = repsRes.data || [];
      }

      return new Response(
        JSON.stringify({
          success: true,
          products: prodsRes.data || [],
          buyers: buyersRes.data || [],
          contractPricing: pricingRes.data || [],
          orders: ordersRes.data || [],
          outward: outwardRes.data || [],
          inward: inwardData,
          routes: routesData,
          salespeople: repsData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    // =========================================================================
    // MANAGER-ONLY ACTIONS (Requires valid x-sg-manager-key)
    // =========================================================================

    } else if (action === "manager_save_product") {
      const items = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await supabase.from("products").upsert(items).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_delete_product") {
      const { id } = payload;
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("contract_pricing").delete().eq("productId", id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_save_inward") {
      const items = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await supabase.from("inventory_inward").upsert(items).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_delete_inward") {
      const { id } = payload;
      const { error } = await supabase.from("inventory_inward").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_delete_outward") {
      const { id } = payload;
      const { error } = await supabase.from("inventory_outward").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_save_route") {
      const items = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await supabase.from("routes").upsert(items).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_delete_route") {
      const { id } = payload;
      const { error } = await supabase.from("routes").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_save_salesperson") {
      const items = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await supabase.from("salespeople").upsert(items).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_save_contract_pricing") {
      const items = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await supabase.from("contract_pricing").upsert(items, { onConflict: "buyerId,productId" }).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_delete_contract_pricing") {
      const { buyerId, productId } = payload;
      const { error } = await supabase.from("contract_pricing").delete().eq("buyerId", buyerId).eq("productId", productId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_update_buyer") {
      const items = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await supabase.from("buyers").upsert(items).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_delete_buyer") {
      const { id } = payload;
      const { error } = await supabase.from("buyers").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("contract_pricing").delete().eq("buyerId", id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_delete_sample") {
      const { id } = payload;
      const { error } = await supabase.from("sample_giveaways").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_delete_order") {
      const { id } = payload;
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "manager_update_order_status" || action === "manager_update_order") {
      const { id, ...rest } = payload;
      const updateData: any = {};
      const allowedFields = [
        "date", "time", "status", "deliveredAt", "notes", "paymentMode",
        "buyerId", "buyerName", "buyerPhone", "buyerAddress", "buyerGstin",
        "dispatchRoute", "items", "totalUnits", "itemsSubtotal", "extraRebate", "netPayable",
        "repId", "repName", "salespersonId", "salespersonName"
      ];
      for (const field of allowedFields) {
        if (rest[field] !== undefined) {
          updateData[field] = rest[field];
        }
      }
      if (rest.status !== undefined) {
        updateData.status = rest.status;
      }
      const { data, error } = await supabase.from("orders").update(updateData).eq("id", id).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Unrecognized action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err: any) {
    console.error("Sync order function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
