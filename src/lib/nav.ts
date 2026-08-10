import type { NavItem } from "@/components/AppShell";

export const CLIENT_NAV: NavItem[] = [
  { to: "/client/dashboard", label: "Tableau de bord" },
  { to: "/client/sos", label: "SOS assistance" },
  { to: "/client/missions", label: "Mes missions" },
  { to: "/client/profil", label: "Mon profil" },
];

export const OPERATOR_NAV: NavItem[] = [
  { to: "/depanneur/dashboard", label: "Tableau de bord" },
  { to: "/depanneur/missions", label: "Missions disponibles" },
  { to: "/depanneur/profil", label: "Mon profil" },
];

export const COMPANY_NAV: NavItem[] = [
  { to: "/entreprise/dashboard", label: "Tableau de bord" },
  { to: "/entreprise/missions", label: "Missions" },
  { to: "/entreprise/operators", label: "Équipe" },
  { to: "/entreprise/vehicles", label: "Véhicules" },
  { to: "/entreprise/equipment", label: "Équipements" },
  { to: "/entreprise/documents", label: "Documents" },
  { to: "/entreprise/revenue", label: "Revenus" },
  { to: "/entreprise/profil", label: "Profil entreprise" },
];

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Supervision" },
  { to: "/admin/missions", label: "Missions" },
  { to: "/admin/users", label: "Utilisateurs" },
  { to: "/admin/operators", label: "Professionnels" },
  { to: "/admin/companies", label: "Entreprises" },
  { to: "/admin/payments", label: "Paiements" },
  { to: "/admin/reviews", label: "Avis" },
  { to: "/admin/settings", label: "Paramètres" },
];
