import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, qs } from "../api/client";
import { useFetch } from "../api/useFetch";
import { ErrorText, Modal, PageHeader } from "../components/ui";
import { fmtMoney } from "../format";
import type { Customer } from "../types";

export function CustomersPage() {
  const [q, setQ] = useState("");
  const { data, error, reload } = useFetch<Customer[]>(`/customers${qs({ q })}`);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader title="Customers" actions={<button className="primary" onClick={() => setCreating(true)}>Add customer</button>} />
      <div className="filters">
        <input placeholder="Search name or email" onKeyDown={(e) => e.key === "Enter" && setQ(e.currentTarget.value)} />
      </div>
      <ErrorText error={error} />
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Location</th><th className="num">Orders</th><th className="num">Lifetime value</th></tr></thead>
        <tbody>
          {data?.map((c) => (
            <tr key={c.id}>
              <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
              <td>{c.email}</td>
              <td>{c.address}</td>
              <td className="num">{c.order_count}</td>
              <td className="num">{fmtMoney(c.lifetime_value ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {creating && <NewCustomer onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
    </>
  );
}

function NewCustomer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/customers", {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const field = (k: keyof typeof form, label: string, type = "text", required = false) => (
    <label>
      {label}
      <input type={type} required={required} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </label>
  );

  return (
    <Modal title="Add customer" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {field("name", "Name", "text", true)}
        {field("email", "Email", "email", true)}
        {field("phone", "Phone", "tel")}
        {field("address", "Address")}
        <ErrorText error={error} />
        <button className="primary">Create</button>
      </form>
    </Modal>
  );
}
