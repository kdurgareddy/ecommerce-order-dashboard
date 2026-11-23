import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { ErrorText, PageHeader } from "../components/ui";

export function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      await api.post("/auth/password", { currentPassword, newPassword });
      setMsg("Password updated.");
      setCurrent("");
      setNew("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="My account" />
      <div className="grid-2">
        <section className="card">
          <h2>Profile</h2>
          <dl>
            <dt>Name</dt><dd>{user?.name}</dd>
            <dt>Email</dt><dd>{user?.email}</dd>
            <dt>Role</dt><dd><span className={`role role-${user?.role}`}>{user?.role}</span></dd>
          </dl>
        </section>
        <form className="card form" onSubmit={submit}>
          <h2>Change password</h2>
          <label>Current password<input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required /></label>
          <label>New password<input type="password" minLength={8} value={newPassword} onChange={(e) => setNew(e.target.value)} required /></label>
          <ErrorText error={error} />
          {msg && <p className="ok">{msg}</p>}
          <button className="primary">Update password</button>
        </form>
      </div>
    </>
  );
}
