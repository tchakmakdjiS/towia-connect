import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authErrorMessage } from "@/lib/auth-errors";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { roleHome } from "@/lib/towia";
import { TowiaLogo } from "@/components/TowiaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Connexion — TowIA" },
      { name: "description", content: "Connectez-vous à votre compte TowIA." },
      { property: "og:title", content: "Connexion — TowIA" },
      { property: "og:description", content: "Connectez-vous à votre compte TowIA." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!loading && session) void navigate({ to: roleHome(role), replace: true });
  }, [loading, session, role, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }
    toast.success("Connexion réussie");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <TowiaLogo />
        </Link>
        <div className="surface-card animate-rise p-6">
          <h1 className="text-xl font-semibold">Connexion</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accédez à votre espace TowIA.
          </p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
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
              {submitting ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
          <div className="mt-5 flex flex-col gap-2 text-center text-sm">
            <Link to="/mot-de-passe-oublie" className="text-muted-foreground hover:text-foreground">
              Mot de passe oublié ?
            </Link>
            <Link to="/inscription" className="text-primary">
              Créer un compte
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
