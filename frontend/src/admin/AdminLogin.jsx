import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminToken, api } from "../lib/api";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { token } = await api.admin.login(email, password);
      adminToken.set(token);
      nav("/admin");
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="admin-login">
      <form onSubmit={submit}>
        <p className="wordmark">Kronebrands</p>
        <h1 className="h2">Admin sign in</h1>
        <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
        <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block">Sign in</button>
      </form>
    </div>
  );
}
