import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authErrorMessage } from "@/lib/auth-errors";
import { Car, Truck, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { roleHome, MISSION_CATEGORIES, type AppRole } from "@/lib/towia";
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

type SignupRole = Exclude<AppRole, "admin">;

const ACCOUNT_TYPES: { role: SignupRole; icon: typeof Car; title: string; text: string }[] = [
  { role: "customer", icon: Car, title: "🚗 Automobiliste", text: "Je cherche une assistance" },
  { role: "tow_operator", icon: Truck, title: "🛻 Dépanneur", text: "Je propose mes services" },
  {
    role: "company",
    icon: Building2,
    title: "🏢 Entreprise",
    text: "Je gère une équipe de dépannage",
  },
];

const VEHICLE_TYPES = [
  "Voiture",
  "Moto",
  "Utilitaire",
  "Poids lourd",
  "Véhicule électrique",
] as const;

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl"
      />
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const { session, role: currentRole, loading } = useAuth();
  const [role, setRole] = useState<SignupRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [siret, setSiret] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [available247, setAvailable247] = useState(false);
  const [iban, setIban] = useState("");
  const [operatorsCount, setOperatorsCount] = useState("");

  useEffect(() => {
    if (!loading && session) void navigate({ to: roleHome(currentRole), replace: true });
  }, [loading, session, currentRole, navigate]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
          role,
          address,
          city,
          postal_code: postalCode,
          company_name: companyName,
          siret,
          service_area: serviceArea,
          vehicle_types: vehicleTypes.join(", "),
          services,
          available_24_7: available247,
          iban,
          operators_count: operatorsCount,
        },
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
    toast.success(
      role === "customer"
        ? "Compte créé"
        : "Compte créé — en attente de validation par TowIA",
    );
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
              {role !== "customer" ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Votre compte sera soumis à validation par l'équipe TowIA.
                </p>
              ) : null}

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="firstName" label="Prénom" value={firstName} onChange={setFirstName} required />
                  <Field id="lastName" label="Nom" value={lastName} onChange={setLastName} required />
                </div>
                <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
                <Field
                  id="phone"
                  label={role === "company" ? "Téléphone professionnel" : "Téléphone"}
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="password"
                    label="Mot de passe"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={setPassword}
                    required
                  />
                  <Field
                    id="confirm"
                    label="Confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirm}
                    onChange={setConfirm}
                    required
                  />
                </div>

                {role !== "customer" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="companyName" label="Nom de l'entreprise" value={companyName} onChange={setCompanyName} required />
                    <Field id="siret" label="SIRET" value={siret} onChange={setSiret} required />
                  </div>
                ) : null}

                <Field
                  id="address"
                  label={role === "tow_operator" ? "Adresse professionnelle" : "Adresse"}
                  value={address}
                  onChange={setAddress}
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="city" label="Ville" value={city} onChange={setCity} required />
                  <Field id="postalCode" label="Code postal" value={postalCode} onChange={setPostalCode} required />
                </div>

                {role === "tow_operator" ? (
                  <>
                    <Field
                      id="serviceArea"
                      label="Zone d'intervention"
                      value={serviceArea}
                      onChange={setServiceArea}
                      required
                    />
                    <div className="space-y-2">
                      <Label>Types de véhicules pris en charge</Label>
                      <div className="flex flex-wrap gap-2">
                        {VEHICLE_TYPES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => toggle(vehicleTypes, setVehicleTypes, v)}
                            className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                              vehicleTypes.includes(v)
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border text-muted-foreground hover:border-primary"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Services proposés</Label>
                      <div className="flex flex-wrap gap-2">
                        {MISSION_CATEGORIES.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => toggle(services, setServices, c.value)}
                            className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                              services.includes(c.value)
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border text-muted-foreground hover:border-primary"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={available247}
                        onChange={(e) => setAvailable247(e.target.checked)}
                        className="size-4 accent-[hsl(var(--primary))]"
                      />
                      Disponibilité 24h/24 7j/7
                    </label>
                    <Field
                      id="iban"
                      label="IBAN (facultatif)"
                      value={iban}
                      onChange={setIban}
                    />
                  </>
                ) : null}

                {role === "company" ? (
                  <Field
                    id="operatorsCount"
                    label="Nombre de dépanneurs"
                    type="number"
                    value={operatorsCount}
                    onChange={setOperatorsCount}
                  />
                ) : null}

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
