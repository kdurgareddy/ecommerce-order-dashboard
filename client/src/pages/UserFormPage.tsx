import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { ErrorText, PageHeader } from "../components/ui";
import type { Role, User } from "../types";

const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, including managing users.",
  manager: "Runs order workflows and manages products and inventory.",
  support: "Views everything; creates customers and orders.",
};

export function UserFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const { data: users } = useFetch<User[]>(editing ? "/users" : null);
  const [form, setForm] = useState({ name: "", email: "", role: "support" as Role, password: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = users?.find((x) => String(x.id) === id);
    if (u) setForm((f) => ({ ...f, name: u.name, email: u.email, role: u.role }));
  }, [users, id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (editing) await api.patch(`/users/${id}`, { name: form.name, role: form.role });
      else await api.post("/users", form);
      nav("/users");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader title={editing ? "Edit user" : "Invite user"} />
      <form className="card form narrow" onSubmit={submit}>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Email<input type="email" value={form.email} disabled={editing} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <fieldset>
          <legend>Role</legend>
          {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
            <label key={r} className="radio">
              <input type="radio" name="role" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} />
              <span><b>{r}</b> <span className="muted">— {ROLE_HELP[r]}</span></span>
            </label>
          ))}
        </fieldset>
        {!editing && (
          <label>Temporary password<input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        )}
        <ErrorText error={error} />
        <button className="primary">{editing ? "Save" : "Create user"}</button>
      </form>
    </>
  );
}
