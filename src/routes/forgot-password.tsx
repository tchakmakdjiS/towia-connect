import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: () => {
    throw redirect({ to: "/mot-de-passe-oublie", replace: true });
  },
  component: () => null,
});
