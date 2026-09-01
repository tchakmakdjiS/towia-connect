import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { profilePath } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/mon-profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — TowIA" },
      { name: "description", content: "Accédez aux informations de votre compte TowIA." },
      { property: "og:title", content: "Mon profil — TowIA" },
      { property: "og:description", content: "Accédez aux informations de votre compte TowIA." },
    ],
  }),
  component: MyProfileRedirect,
});

function MyProfileRedirect() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    void navigate({ to: profilePath(role), replace: true });
  }, [loading, role, navigate]);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <p className="text-sm text-muted-foreground">Ouverture de votre profil…</p>
    </div>
  );
}
