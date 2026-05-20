import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { paths } from "@/config/paths";

// --- Configuration des règles de sécurité ---
const RULES = [
  { id: "len", label: "12 caractères minimum", test: (v: string) => v.length >= 12 },
  { id: "dig", label: "Au moins un chiffre (0–9)", test: (v: string) => /[0-9]/.test(v) },
  { id: "upp", label: "Au moins une majuscule (A–Z)", test: (v: string) => /[A-Z]/.test(v) },
  { id: "low", label: "Au moins une minuscule (a–z)", test: (v: string) => /[a-z]/.test(v) },
  { id: "spe", label: "Au moins un caractère spécial", test: (v: string) => /[!@#$%^&*]/.test(v) },
];

export default function LoginRoute() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPwd, setShowPwd] = useState(false);
  const [alert, setAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  // States pour les formulaires
  const [lEmail, setLEmail] = useState("");
  const [lPwd, setLPwd] = useState("");
  const [lErrors, setLErrors] = useState<Record<string, string>>({});

  const [rName, setRName] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPwd, setRPwd] = useState("");
  const [rPwd2, setRPwd2] = useState("");
  const [rErrors, setRErrors] = useState<Record<string, string>>({});

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Calcul de la force du mot de passe
  const strength = RULES.filter(r => r.test(rPwd)).length;
  const strengthPct = [0, 20, 45, 65, 85, 100][strength];
  const strengthColor = ["#E24B4A", "#E24B4A", "#EF9F27", "#EF9F27", "#1D9E75", "#1D9E75"][strength];

  const handleLogin = async () => {
    const errs: Record<string, string> = {};
    if (!validateEmail(lEmail)) errs.email = "Adresse e-mail invalide.";
    if (!lPwd) errs.pwd = "Mot de passe requis.";
    setLErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setAlert({ msg: "Connexion en cours...", type: "success" });

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lEmail, password: lPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem("jwt",      data.token);
localStorage.setItem("username", data.username);
localStorage.setItem("email",    data.email);
localStorage.setItem("isAdmin",  String(data.isAdmin));

      if (data.mustChangePassword) {
        navigate("/change-password");
      } else {
        navigate(paths.chat);
      }
    } catch (err: any) {
      setAlert({ msg: err.message || "Erreur de connexion.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const errs: Record<string, string> = {};
    if (!rName) errs.name = "Nom d'utilisateur requis.";
    if (!validateEmail(rEmail)) errs.email = "Adresse e-mail invalide.";
    if (RULES.some(r => !r.test(rPwd))) errs.pwd = "Mot de passe non conforme.";
    if (rPwd !== rPwd2) errs.pwd2 = "Les mots de passe ne correspondent pas.";
    setRErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: rName, email: rEmail, password: rPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAlert({ msg: "Compte créé ! Redirection...", type: "success" });
      localStorage.setItem("jwt", data.token);
      localStorage.setItem("username", data.username);
      setTimeout(() => navigate(paths.chat), 1000);
    } catch (err: any) {
      setAlert({ msg: err.message || "Erreur d'inscription.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
    <div className="auth-wrap">
      <div className="card">
        {/* Logo Section */}
        <div className="logo">
          <div className="logo-icon"><i className="ti ti-brain" /></div>
          <span className="logo-text">MonRAG</span>
        </div>

        {/* Tabs Section */}
        <div className="tab-row">
          <button 
            className={`tab ${tab === 'login' ? 'active' : ''}`} 
            onClick={() => { setTab('login'); setAlert(null); }}
          >
            Connexion
          </button>
          <button 
            className={`tab ${tab === 'register' ? 'active' : ''}`} 
            onClick={() => { setTab('register'); setAlert(null); }}
          >
            Créer un compte
          </button>
        </div>

        {/* Alert Message */}
        {alert && (
          <div className={`alert alert-${alert.type} show`}>
            <i className={`ti ${alert.type === 'success' ? 'ti-circle-check' : 'ti-alert-circle'}`} />
            <span>{alert.msg}</span>
          </div>
        )}

        {/* FORMULAIRE DE CONNEXION */}
        {tab === "login" && (
          <div id="form-login">
            <div className="field">
              <label>Adresse e-mail</label>
              <div className="input-wrap">
                <input 
                  type="email" 
                  className={lErrors.email ? 'err' : ''}
                  value={lEmail} 
                  onChange={(e) => setLEmail(e.target.value)}
                  placeholder="vous@exemple.com" 
                />
              </div>
              {lErrors.email && <span className="err-msg show">{lErrors.email}</span>}
            </div>

            <div className="field">
              <label>Mot de passe</label>
              <div className="input-wrap">
                <input 
                  type={showPwd ? "text" : "password"} 
                  className={lErrors.pwd ? 'err' : ''}
                  value={lPwd}
                  onChange={(e) => setLPwd(e.target.value)}
                  placeholder="••••••••" 
                />
                <button className="eye-btn" onClick={() => setShowPwd(!showPwd)}>
                  <i className={`ti ${showPwd ? 'ti-eye-off' : 'ti-eye'}`} />
                </button>
              </div>
              {lErrors.pwd && <span className="err-msg show">{lErrors.pwd}</span>}
            </div>

            <button className="submit-btn" onClick={handleLogin} disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
            <p className="first-login-note">Première connexion ? Vous serez invité à changer votre mot de passe.</p>
          </div>
        )}

        {/* FORMULAIRE D'INSCRIPTION */}
        {tab === "register" && (
          <div id="form-register">
            <div className="field">
              <label>Nom d'utilisateur</label>
              <div className="input-wrap">
                <input 
                  type="text" 
                  className={rErrors.name ? 'err' : ''}
                  value={rName}
                  onChange={(e) => setRName(e.target.value)}
                  placeholder="jean.dupont" 
                />
              </div>
              {rErrors.name && <span className="err-msg show">{rErrors.name}</span>}
            </div>

            <div className="field">
              <label>Adresse e-mail</label>
              <div className="input-wrap">
                <input 
                  type="email" 
                  className={rErrors.email ? 'err' : ''}
                  value={rEmail}
                  onChange={(e) => setREmail(e.target.value)}
                  placeholder="vous@exemple.com" 
                />
              </div>
              {rErrors.email && <span className="err-msg show">{rErrors.email}</span>}
            </div>

            <div className="field">
              <label>Mot de passe</label>
              <div className="input-wrap">
                <input 
                  type={showPwd ? "text" : "password"} 
                  className={rErrors.pwd ? 'err' : ''}
                  value={rPwd}
                  onChange={(e) => setRPwd(e.target.value)}
                  placeholder="••••••••" 
                />
                <button className="eye-btn" onClick={() => setShowPwd(!showPwd)}>
                  <i className={`ti ${showPwd ? 'ti-eye-off' : 'ti-eye'}`} />
                </button>
              </div>
              
            </div>

            <div className="rules show">
              {RULES.map(rule => {
                const isOk = rule.test(rPwd);
                return (
                  <div key={rule.id} className={`rule ${isOk ? 'ok' : 'fail'}`}>
                    <i className={`ti ${isOk ? 'ti-circle-check' : 'ti-circle-x'}`} />
                    {rule.label}
                  </div>
                );
              })}
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Confirmer le mot de passe</label>
              <div className="input-wrap">
                <input 
                  type="password" 
                  className={rErrors.pwd2 ? 'err' : ''}
                  value={rPwd2}
                  onChange={(e) => setRPwd2(e.target.value)}
                  placeholder="••••••••" 
                />
              </div>
              {rErrors.pwd2 && <span className="err-msg show">{rErrors.pwd2}</span>}
            </div>

            <button className="submit-btn" onClick={handleRegister} disabled={loading}>
              {loading ? "Création..." : "Créer le compte"}
            </button>
          </div>
        )}

        <p className="switch-text">
          {tab === 'login' ? (
            <>Pas encore de compte ? <a onClick={() => setTab('register')}>Créer un compte</a></>
          ) : (
            <>Déjà un compte ? <a onClick={() => setTab('login')}>Se connecter</a></>
          )}
        </p>
      </div>
      </div>

      <style>{`
        .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1rem;  }
        .card { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 2rem; width: 100%; max-width: 420px; box-shadow: var(--shadow-sm); }
        .logo { display: flex; align-items: center; gap: 8px; margin-bottom: 1.5rem; }
        .logo-icon { width: 36px; height: 36px; background: #7F77DD; border-radius: var(--border-radius-md); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; }
        .logo-text { font-size: 18px; font-weight: 500; color: var(--color-text-primary); }
        .tab-row { display: flex; gap: 4px; margin-bottom: 1.5rem; background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 3px; }
        .tab { flex: 1; padding: 7px; text-align: center; font-size: 14px; cursor: pointer; border-radius: 6px; border: none; background: transparent; color: var(--color-text-secondary); transition: all .15s; }
        .tab.active { background: var(--color-background-primary); color: var(--color-text-primary); font-weight: 500; border: 0.5px solid var(--color-border-tertiary); }
        .field { margin-bottom: 14px; }
        label { display: block; font-size: 13px; color: var(--color-text-secondary); margin-bottom: 5px; text-align: left; }
        .input-wrap { position: relative; }
        input { width: 100%; padding: 9px 12px; font-size: 14px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-tertiary); background: var(--color-background-primary); color: var(--color-text-primary); outline: none; }
        input:focus { border-color: #7F77DD; box-shadow: 0 0 0 2px rgba(127,119,221,0.15); }
        input.err { border-color: #E24B4A; }
        .eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--color-text-tertiary); }
        .submit-btn { width: 100%; padding: 10px; font-size: 14px; font-weight: 500; border-radius: var(--border-radius-md); border: none; background: #7F77DD; color: #fff; cursor: pointer; margin-top: 10px; }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .alert { padding: 10px 12px; border-radius: var(--border-radius-md); font-size: 13px; margin-bottom: 14px; display: none; align-items: center; gap: 8px; }
        .alert.show { display: flex; }
        .alert-error { background: var(--color-background-danger); color: var(--color-text-danger); }
        .alert-success { background: var(--color-background-success); color: var(--color-text-success); }
        .rules { background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 10px 12px; }
        .rule { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary); padding: 2px 0; }
        .rule.ok { color: var(--color-text-success); }
        .rule.fail i { color: #E24B4A; }
        .rule.ok i { color: #1D9E75; }
        .strength-bar { height: 3px; border-radius: 2px; margin-top: 6px; background: var(--color-background-secondary); overflow: hidden; }
        .strength-fill { height: 100%; transition: all 0.3s; }
        .err-msg { font-size: 12px; color: #E24B4A; margin-top: 4px; display: none; text-align: left; }
        .err-msg.show { display: block; }
        .switch-text { text-align: center; font-size: 13px; color: var(--color-text-secondary); margin-top: 14px; }
        .switch-text a { color: #7F77DD; cursor: pointer; font-weight: 500; }
        .first-login-note { font-size: 11px; color: var(--color-text-tertiary); margin-top: 12px; text-align: center; }
        .auth-container {
  /* Couleurs extraites de image_a18d19.png */
  --color-background-primary: #ffffff;
  --color-background-secondary: #f3f3f1;
  --color-background-tertiary: #f8f9fa;
  
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-tertiary: #9ca3af;
  
  --color-border-tertiary: #e5e7eb;
  --color-primary: #7F77DD;
  
  /* Rayons de bordure comme sur le design */
  --border-radius-sm: 6px;
  --border-radius-md: 10px;
  --border-radius-lg: 16px; /* L'arrondi prononcé de la carte blanche */
  
  /* Font */
  --font-sans: 'Inter', system-ui, sans-serif;

  /* Styles de base pour le conteneur */
  font-family: var(--font-sans);

}
      `}</style>
    </div>
  );
}