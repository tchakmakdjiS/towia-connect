import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the active company owned by the caller (RLS as the caller). */
async function callerCompany(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, verification")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Seul un compte Entreprise peut gérer une équipe.");
  return data as { id: string; verification: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED" };
}

const inviteSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(30).optional().nullable(),
  redirectTo: z.string().url(),
});

/** Invite a team operator: creates the auth account (no password stored) and links it to the caller's company. */
export const inviteTeamOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const company = await callerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
      data: { role: "tow_operator", first_name: data.firstName, last_name: data.lastName, phone: data.phone ?? null },
    });
    if (error || !invited.user) {
      const msg = error?.message ?? "";
      if (/already|registered|exists/i.test(msg)) {
        throw new Error("Un compte TowIA existe déjà avec cette adresse e-mail.");
      }
      if (/not allowed|invalid/i.test(msg)) throw new Error("Cette adresse e-mail n'est pas valide ou ne peut pas recevoir d'e-mail.");
      if (/rate|limit/i.test(msg)) throw new Error("Trop d'invitations envoyées. Réessayez dans quelques minutes.");
      throw new Error(msg || "Invitation impossible");
    }

    // The signup trigger created an operators row for this user; link it server-side to the company.
    const { error: upErr } = await supabaseAdmin
      .from("operators")
      .update({
        company_id: company.id,
        company_name: null,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone || null,
        account_status: "INVITED",
        verification: company.verification === "VERIFIED" ? "VERIFIED" : "PENDING",
      })
      .eq("user_id", invited.user.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/** Re-send the invitation / password setup e-mail to a team member of the caller's company. */
export const reinviteTeamOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ operatorId: z.string().uuid(), redirectTo: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const company = await callerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: op } = await supabaseAdmin
      .from("operators")
      .select("email, user_id, company_id")
      .eq("id", data.operatorId)
      .maybeSingle();
    if (!op || op.company_id !== company.id || !op.email) throw new Error("Dépanneur introuvable");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(op.email, { redirectTo: data.redirectTo });
    if (error) {
      const { error: e2 } = await supabaseAdmin.auth.resetPasswordForEmail(op.email, { redirectTo: data.redirectTo });
      if (e2) throw new Error(e2.message);
    }
    return { ok: true };
  });

/** Account state of each team member (invitation pending / active) read from Auth. */
export const getTeamAccountStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const company = await callerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ops } = await supabaseAdmin
      .from("operators")
      .select("id, user_id, account_status")
      .eq("company_id", company.id);
    const out: Record<string, "INVITED" | "ACTIVE" | "DISABLED" | "NO_ACCOUNT"> = {};
    for (const o of ops ?? []) {
      if (o.account_status === "DISABLED") { out[o.id] = "DISABLED"; continue; }
      if (!o.user_id) { out[o.id] = "NO_ACCOUNT"; continue; }
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(o.user_id);
      const active = !!u.user?.last_sign_in_at;
      out[o.id] = active ? "ACTIVE" : "INVITED";
      if (active && o.account_status === "INVITED") {
        await supabaseAdmin.from("operators").update({ account_status: "ACTIVE" }).eq("id", o.id);
      }
    }
    return out;
  });
