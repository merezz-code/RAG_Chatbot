import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function OAuthCallbackRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    // Lire les params IMMÉDIATEMENT avant tout replaceState
    const params   = new URLSearchParams(window.location.search);
    const token    = params.get("token");
    const username = params.get("username") ?? "";
    const email    = params.get("email") ?? "";
    const isAdmin  = params.get("isAdmin") === "true";

    // Si déjà traité (2ème mount StrictMode), token absent mais JWT déjà sauvé
    if (!token) {
      const saved = localStorage.getItem("jwt");
      if (saved) {
        navigate("/chat", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
      return;
    }

    // Sauvegarder
    localStorage.setItem("jwt",      token);
    localStorage.setItem("username", username);
    localStorage.setItem("email",    email);
    localStorage.setItem("isAdmin",  String(isAdmin));

    // Nettoyer l'URL APRÈS avoir sauvegardé
    window.history.replaceState({}, "", "/auth/callback");
    navigate("/chat", { replace: true });
  }, [navigate]);

  return (
    <div style={{ textAlign: "center", marginTop: "30vh", color: "#6b7280" }}>
      <p>Connexion en cours…</p>
    </div>
  );
}