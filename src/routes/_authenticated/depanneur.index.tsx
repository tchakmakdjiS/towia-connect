import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/depanneur/")({
  beforeLoad: () => {
    throw redirect({ to: "/depanneur/dashboard", replace: true });
  },
  component: () => null,
});
