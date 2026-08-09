import type { NavItem } from "@/components/AppShell";

export const CLIENT_NAV: NavItem[] = [
  { to: "/client/dashboard", label: "Tableau de bord" },
  { to: "/client/sos", label: "SOS assistance" },
  { to: "/client/missions", label: "Mes missions" },
  { to: "/client/profile", label: "Mon profil" },
];

export const OPERATOR_NAV: NavItem[] = [
  { to: "/operator/dashboard", label: "Tableau de bord" },
  { to: "/operator/missions", label: "Missions disponibles" },
  { to: "/operator/profile", label: "Mon profil" },
];

export const COMPANY_NAV: NavItem[] = [
  { to: "/company/dashboard", label: "Tableau de bord" },
  { to: "/company/missions", label: "Missions" },
  { to: "/company/operators", label: "Équipe" },
  { to: "/company/vehicles", label: "Véhicules" },
  { to: "/company/equipment", label: "Équipements" },
  { to: "/company/documents", label: "Documents" },
  { to: "/company/revenue", label: "Revenus" },
  { to: "/company/profile", label: "Profil entreprise" },
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
