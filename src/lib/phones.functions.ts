import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/open-access";

export const listPhoneDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("phone_devices")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { devices: data ?? [] };
  });

export const savePhoneDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      mac_address: string;
      label?: string;
      model?: string;
      sip_username?: string;
      sip_password?: string;
      sip_server?: string;
      sip_port?: number;
      ringtone_url?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const mac = data.mac_address.toLowerCase().replace(/[^a-f0-9]/g, "");
    if (mac.length !== 12) throw new Error("MAC must be 12 hex characters");
    const row = {
      owner_id: context.userId,
      mac_address: mac,
      label: data.label ?? null,
      model: data.model ?? null,
      sip_username: data.sip_username ?? null,
      sip_password: data.sip_password ?? null,
      sip_server: data.sip_server ?? null,
      sip_port: data.sip_port ?? 5060,
      ringtone_url: data.ringtone_url ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("phone_devices")
        .update(row)
        .eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await (context.supabase.from("phone_devices") as any)
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: ins.id };
  });

export const deletePhoneDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("phone_devices").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listPhoneCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("phone_calls")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { calls: data ?? [] };
  });
