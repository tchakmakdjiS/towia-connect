import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TowiaLogo } from "@/components/TowiaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — TowIA" },
      {
        name: "description",
        content: "Réinitialisez le mot de passe de votre compte TowIA.",
      },
      { property: "og:title", content: "Mot de passe oublié — TowIA" },
      { property: "og:description", content: "Recevez un lien de réinitialisation TowIA." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <TowiaLogo />
        </Link>
        <div className="surface-card animate-rise p-6">
          <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
          {sent ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Si un compte existe pour {email}, un lien de réinitialisation vient d'être envoyé.
            </p>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-primary"
              >
                {submitting ? "Envoi..." : "Recevoir le lien"}
              </Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm">
            <Link to="/connexion" className="text-muted-foreground hover:text-foreground">
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
