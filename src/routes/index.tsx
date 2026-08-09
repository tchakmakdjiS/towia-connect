import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Siren,
  Brain,
  MapPin,
  Truck,
  Activity,
  CreditCard,
  Star,
  ShieldCheck,
  Building2,
  Car,
} from "lucide-react";
import { TowiaLogo } from "@/components/TowiaLogo";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-towia.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TowIA — Votre assistance automobile, simplement." },
      {
        name: "description",
        content:
          "TowIA connecte automatiquement les automobilistes aux dépanneurs et remorqueurs grâce à un dispatch intelligent : SOS, localisation, suivi, paiement et avis.",
      },
      { property: "og:title", content: "TowIA — Votre assistance automobile, simplement." },
      {
        property: "og:description",
        content:
          "Assistance automobile intelligente : SOS en un geste, analyse IA du problème, dispatch du bon professionnel, suivi en temps réel.",
      },
    ],
  }),
  component: Landing,
});

const FLOW = [
  { icon: Siren, title: "SOS", text: "Un bouton pour demander de l'aide immédiatement." },
  { icon: Brain, title: "Analyse IA", text: "TowIA comprend le problème et pose les bonnes questions." },
  { icon: MapPin, title: "Localisation", text: "Vous partagez et confirmez votre position." },
  { icon: Truck, title: "Dispatch", text: "Le professionnel le plus adapté est sélectionné." },
  { icon: Activity, title: "Suivi", text: "Vous suivez l'avancement de l'intervention." },
  { icon: CreditCard, title: "Paiement", text: "Règlement sécurisé une fois la mission terminée." },
  { icon: Star, title: "Avis", text: "Vous notez le professionnel sur 5 critères." },
];

const PROFILES = [
  {
    icon: Car,
    title: "Automobiliste",
    text: "Demandez une assistance en quelques secondes et suivez votre dépanneur.",
  },
  {
    icon: Truck,
    title: "Dépanneur",
    text: "Recevez des missions qualifiées près de vous et gérez vos interventions.",
  },
  {
    icon: Building2,
    title: "Entreprise",
    text: "Pilotez votre équipe, vos véhicules, vos équipements et vos revenus.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <TowiaLogo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-xl">
            <Link to="/login">Connexion</Link>
          </Button>
          <Button asChild className="rounded-xl bg-gradient-primary">
            <Link to="/register">Créer un compte</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" /> Plateforme d'assistance intelligente
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
            Votre assistance automobile,{" "}
            <span className="text-gradient-primary">simplement.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground">
            TowIA analyse votre situation, vous localise et met en relation le professionnel du
            dépannage le plus adapté. De l'appel au paiement, tout est suivi au même endroit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-2xl bg-gradient-primary shadow-elevated">
              <Link to="/register">
                <Siren className="mr-2 size-5" /> Demander une assistance
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="rounded-2xl">
              <Link to="/register">Je suis un professionnel</Link>
            </Button>
          </div>
        </div>

        <div className="surface-card overflow-hidden p-0">
          <img
            src={heroImage}
            alt="Dépanneur TowIA intervenant de nuit auprès d'un automobiliste"
            width={1600}
            height={1008}
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <section className="border-y border-border bg-card/40 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-semibold">Comment ça marche</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Un parcours continu, de la demande à l'avis.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((step, i) => (
              <div key={step.title} className="surface-card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                    <step.icon className="size-5" />
                  </span>
                  <span className="text-xs text-muted-foreground">Étape {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Pour qui ?</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PROFILES.map((p) => (
            <div key={p.title} className="surface-card p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground">
                <p.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <TowiaLogo compact />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TowIA — Votre assistance automobile, simplement.
          </p>
        </div>
      </footer>
    </div>
  );
}
