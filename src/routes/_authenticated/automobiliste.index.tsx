import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/automobiliste/")({
  beforeLoad: () => {
    throw redirect({ to: "/client/dashboard", replace: true });
  },
  component: () => null,
});
