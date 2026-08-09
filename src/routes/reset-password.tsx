import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TowiaLogo } from "@/components/TowiaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — TowIA" },
      { name: "description", content: "Définissez un nouveau mot de passe TowIA." },
      { property: "og:title", content: "Nouveau mot de passe — TowIA" },
      { property: "og:description", content: "Définissez un nouveau mot de passe TowIA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe mis à jour");
    void navigate({ to: "/client/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <TowiaLogo />
        </Link>
        <div className="surface-card animate-rise p-6">
          <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-primary"
            >
              {submitting ? "Enregistrement..." : "Mettre à jour"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
