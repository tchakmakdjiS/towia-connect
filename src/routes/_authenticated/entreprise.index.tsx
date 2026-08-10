import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/entreprise/")({
  beforeLoad: () => {
    throw redirect({ to: "/entreprise/dashboard", replace: true });
  },
  component: () => null,
});
