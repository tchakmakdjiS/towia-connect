/** Traduction en français des erreurs Supabase Auth. */
export function authErrorMessage(error: { message?: string; status?: number } | null): string {
  const raw = (error?.message ?? "").toLowerCase();

  if (!raw) return "Une erreur est survenue. Veuillez réessayer.";
  if (raw.includes("invalid login credentials"))
    return "Adresse email ou mot de passe incorrect.";
  if (raw.includes("email not confirmed"))
    return "Votre adresse email n'est pas encore confirmée. Consultez votre boîte mail.";
  if (raw.includes("user already registered") || raw.includes("already been registered"))
    return "Un compte existe déjà avec cette adresse email.";
  if (raw.includes("password should be at least"))
    return "Le mot de passe doit contenir au moins 8 caractères.";
  if (raw.includes("unable to validate email") || raw.includes("invalid email"))
    return "Adresse email invalide.";
  if (raw.includes("for security purposes") || raw.includes("rate limit") || raw.includes("too many"))
    return "Trop de tentatives. Veuillez patienter quelques instants.";
  if (raw.includes("jwt") || raw.includes("session") || raw.includes("token"))
    return "Votre session a expiré. Veuillez vous reconnecter.";
  if (raw.includes("new password should be different"))
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (raw.includes("signups not allowed") || raw.includes("signup is disabled"))
    return "Les inscriptions sont temporairement désactivées.";
  if (raw.includes("failed to fetch") || raw.includes("network"))
    return "Connexion au serveur impossible. Vérifiez votre connexion internet.";

  return "Une erreur est survenue. Veuillez réessayer.";
}
