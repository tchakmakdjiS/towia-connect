import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TowiaLogo } from "@/components/TowiaLogo";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { requiredRoleForPath, roleHome } from "@/lib/towia";

export type NavItem = { to: string; label: string };


export function AppShell({
  title,
  subtitle,
  nav,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
  action?: ReactNode;
}) {
  const { user, role, loading, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  // Protection par rôle : un utilisateur ne peut pas accéder à l'espace d'un autre rôle.
  const required = requiredRoleForPath(pathname);
  useEffect(() => {
    if (loading || !role || !required) return;
    if (role !== required && role !== "admin") {
      void navigate({ to: roleHome(role), replace: true });
    }
  }, [loading, role, required, navigate]);



  const navLinks = (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Link to="/" className="mb-8 block">
          <TowiaLogo />
        </Link>
        {navLinks}
        <div className="mt-auto space-y-3 pt-6">
          <p className="truncate text-xs text-muted-foreground">
            {user?.email} · {role ?? "—"}
          </p>
          <Button variant="secondary" className="w-full rounded-xl" onClick={() => void signOut()}>
            <LogOut className="mr-2 size-4" /> Déconnexion
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-4">
              <SheetHeader className="px-0">
                <SheetTitle className="text-left">
                  <TowiaLogo />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4">{navLinks}</div>
              <Button
                variant="secondary"
                className="mt-6 w-full rounded-xl"
                onClick={() => void signOut()}
              >
                <LogOut className="mr-2 size-4" /> Déconnexion
              </Button>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{title}</h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action}
          <NotificationBell />
          <UserMenu />
        </header>


        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
