import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sg-terminal-key, x-sg-rep-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Configurable terminal secret key (matches the field terminal header)
const TERMINAL_SECRET_KEY = Deno.env.get("SG_TERMINAL_KEY") || "SG-FIELD-TERMINAL-SECURE-KEY-2026";

Deno.serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Validate Authorization / Terminal Key
    const terminalKey = req.headers.get("x-sg-terminal-key");
    const authHeader = req.headers.get("authorization");

    const isAuthorized =
      (terminalKey && terminalKey === TERMINAL_SECRET_KEY) ||
      (authHeader && authHeader.includes(TERMINAL_SECRET_KEY));

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: Invalid or missing representative terminal signature.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Initialize Admin Supabase Client using Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase internal service credentials missing on Edge runtime.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Parse Request
    const body = await req.json().catch(() => ({}));
    const { action, payload } = body;

    // 5. Action Handlers
    if (action === "submit_order") {
      const order = payload;
      if (!order || !order.id || !order.buyerId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required order fields." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        repId: String(order.repId || ""),
        repName: String(order.repName || ""),
        salespersonId: String(order.salespersonId || order.repId || ""),
        salespersonName: String(order.salespersonName || order.repName || ""),
        dispatchRoute: String(order.dispatchRoute || ""),
        items: Array.isArray(order.items) ? order.items : [],
        itemsSubtotal: Number(order.itemsSubtotal || 0),
        totalUnits: Number(order.totalUnits || 0),
        extraRebate: Number(order.extraRebate || 0),
        netPayable: Number(order.netPayable || 0),
        amountPaid: Number(order.amountPaid || 0),
        balanceDue: Number(order.balanceDue || 0),
        paymentMode: String(order.paymentMode || "Cash on Delivery"),
        status: String(order.status || "Pending Delivery"),
        notes: String(order.notes || ""),
      };

      // Insert order into orders table
      const { data: insertedOrder, error: orderErr } = await supabase
        .from("orders")
        .upsert([dbOrder])
        .select()
        .single();

      if (orderErr) throw orderErr;

      // Update customer ledger balance if unpaid balance exists
      const balanceDue = Number(order.balanceDue || 0);
      if (balanceDue > 0) {
        const { data: buyerData } = await supabase
          .from("buyers")
          .select("pendingUdhaar")
          .eq("id", dbOrder.buyerId)
          .single();

        const currentUdhaar = Number(buyerData?.pendingUdhaar || 0);
        const updatedUdhaar = currentUdhaar + balanceDue;

        await supabase
          .from("buyers")
          .update({ pendingUdhaar: updatedUdhaar })
          .eq("id", dbOrder.buyerId);
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
        repId: String(sample.repId || ""),
        repName: String(sample.repName || ""),
        buyerId: String(sample.buyerId || ""),
        buyerName: String(sample.buyerName || ""),
        buyerPhone: String(sample.buyerPhone || ""),
        productId: String(sample.productId || ""),
        productName: String(sample.productName || ""),
        sku: String(sample.sku || ""),
        qty: Number(sample.qty || 1),
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

    } else if (action === "get_bootstrap") {
      // Fast parallel fetch of products, buyers, contract pricing, and orders
      const [prodsRes, buyersRes, pricingRes, ordersRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("buyers").select("*"),
        supabase.from("contract_pricing").select("*"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          products: prodsRes.data || [],
          buyers: buyersRes.data || [],
          contractPricing: pricingRes.data || [],
          orders: ordersRes.data || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

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
