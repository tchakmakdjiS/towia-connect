import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authErrorMessage } from "@/lib/auth-errors";
import { Car, Truck, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { roleHome, type AppRole } from "@/lib/towia";
import { TowiaLogo } from "@/components/TowiaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/inscription")({
  head: () => ({
    meta: [
      { title: "Créer un compte — TowIA" },
      {
        name: "description",
        content:
          "Créez votre compte TowIA : automobiliste, dépanneur ou entreprise de dépannage.",
      },
      { property: "og:title", content: "Créer un compte — TowIA" },
      {
        property: "og:description",
        content: "Automobiliste, dépanneur ou entreprise : rejoignez TowIA.",
      },
    ],
  }),
  component: RegisterPage,
});

const ACCOUNT_TYPES: { role: Exclude<AppRole, "admin">; icon: typeof Car; title: string; text: string }[] = [
  { role: "customer", icon: Car, title: "🚗 Automobiliste", text: "Je cherche une assistance" },
  { role: "tow_operator", icon: Truck, title: "🛻 Dépanneur", text: "Je propose mes services" },
  {
    role: "company",
    icon: Building2,
    title: "🏢 Entreprise",
    text: "Je gère une équipe de dépannage",
  },
];

function RegisterPage() {
  const navigate = useNavigate();
  const { session, role: currentRole, loading } = useAuth();
  const [role, setRole] = useState<Exclude<AppRole, "admin"> | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: roleHome(currentRole), replace: true });
  }, [loading, session, currentRole, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { first_name: firstName, last_name: lastName, phone, role },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }
    if (!data.session) {
      setSent(true);
      toast.success("Vérifiez votre boîte mail pour confirmer votre compte.");
      return;
    }
    toast.success("Compte créé");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Link to="/" className="mb-8 flex justify-center">
          <TowiaLogo />
        </Link>

        <div className="surface-card animate-rise p-6">
          {sent ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold">Confirmez votre email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Un lien de confirmation vient d'être envoyé à {email}. Votre compte sera actif
                dès validation.
              </p>
              <Button asChild variant="secondary" className="mt-6 rounded-xl">
                <Link to="/connexion">Retour à la connexion</Link>
              </Button>
            </div>
          ) : !role ? (
            <>
              <h1 className="text-xl font-semibold">
                Quel type de compte souhaitez-vous créer ?
              </h1>
              <div className="mt-6 space-y-3">
                {ACCOUNT_TYPES.map((t) => (
                  <button
                    key={t.role}
                    type="button"
                    onClick={() => setRole(t.role)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <t.icon className="size-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">{t.title}</span>
                      <span className="block text-sm text-muted-foreground">{t.text}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Déjà inscrit ?{" "}
                <Link to="/connexion" className="text-primary">
                  Se connecter
                </Link>
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRole(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Changer de type de compte
              </button>
              <h1 className="mt-3 text-xl font-semibold">
                {ACCOUNT_TYPES.find((t) => t.role === role)?.title}
              </h1>
              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
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
                  {submitting ? "Création..." : "Créer mon compte"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
