import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { ErrorText, PageHeader } from "../components/ui";
import { fmtDate } from "../format";
import type { Adjustment, Product } from "../types";

export function ProductFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const { data: existing } = useFetch<Product & { adjustments: Adjustment[] }>(editing ? `/products/${id}` : null);
  const [form, setForm] = useState({ sku: "", name: "", price: 0, stock: 0, low_stock_threshold: 5 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) setForm({ sku: existing.sku, name: existing.name, price: existing.price, stock: existing.stock, low_stock_threshold: existing.low_stock_threshold });
  }, [existing]);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        const { stock: _stock, ...body } = form; // stock changes go through adjustments
        void _stock;
        await api.put(`/products/${id}`, body);
      } else {
        await api.post("/products", form);
      }
      nav("/inventory");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader title={editing ? `Edit ${existing?.name ?? "product"}` : "Add product"} />
      <div className="grid-2">
        <form className="card form" onSubmit={submit}>
          <label>SKU<input value={form.sku} onChange={set("sku")} required pattern="[A-Za-z0-9\-_]+" /></label>
          <label>Name<input value={form.name} onChange={set("name")} required /></label>
          <label>Price (USD)<input type="number" step="0.01" min={0} value={form.price} onChange={set("price")} required /></label>
          {!editing && <label>Opening stock<input type="number" min={0} value={form.stock} onChange={set("stock")} /></label>}
          <label>Low-stock threshold<input type="number" min={0} value={form.low_stock_threshold} onChange={set("low_stock_threshold")} /></label>
          <ErrorText error={error} />
          <button className="primary">{editing ? "Save changes" : "Create product"}</button>
        </form>
        {editing && existing && (
          <section className="card">
            <h2>Recent stock adjustments</h2>
            <ul className="timeline">
              {existing.adjustments.map((a) => (
                <li key={a.id}>
                  <b className={a.delta > 0 ? "pos" : "neg"}>{a.delta > 0 ? `+${a.delta}` : a.delta}</b> {a.reason}
                  <div className="muted small">{fmtDate(a.created_at)} · {a.user_name}</div>
                </li>
              ))}
              {existing.adjustments.length === 0 && <li className="muted">No adjustments yet.</li>}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
