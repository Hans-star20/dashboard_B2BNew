"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error || "Email atau password tidak valid.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Tidak dapat menghubungi server. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div><strong>B2B<span>Dashboard</span></strong><small>NETWORK OPERATIONS</small></div>
        </div>
        <div className="login-heading">
          <span className="login-kicker">SELAMAT DATANG KEMBALI</span>
          <h1>Masuk ke akun Anda</h1>
          <p>Gunakan akun perusahaan untuk melanjutkan ke dashboard.</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="login-email">Email perusahaan</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@perusahaan.co.id"
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Masukkan password"
          />
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Memverifikasi..." : "Masuk"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>
        <div className="login-footer"><span className="online-dot" /> Akses aman untuk operasional perusahaan</div>
      </section>
      <p className="login-disclaimer">B2B Dashboard <i /> Sistem monitoring operasional</p>
    </main>
  );
}
