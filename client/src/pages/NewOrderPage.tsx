import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useFetch } from "../api/useFetch";
import { ErrorText, PageHeader } from "../components/ui";
import { fmtMoney } from "../format";
import type { Customer, OrderDetail, Product } from "../types";

interface Line { productId: number; quantity: number }

export function NewOrderPage() {
  const nav = useNavigate();
  const { data: customers } = useFetch<Customer[]>("/customers");
  const { data: products } = useFetch<Product[]>("/products");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [lines, setLines] = useState<Line[]>([{ productId: 0, quantity: 1 }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const total = lines.reduce((s, l) => s + (byId.get(l.productId)?.price ?? 0) * l.quantity, 0);
  const valid = customerId !== "" && lines.every((l) => l.productId && l.quantity > 0);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const order = await api.post<OrderDetail>("/orders", { customerId, items: lines, notes: notes || undefined });
      nav(`/orders/${order.id}`);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409 && Array.isArray(err.details)) {
        setError(err.details.map((d: { name: string; available: number }) => `${d.name}: only ${d.available} left`).join("; "));
      } else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New order" />
      <section className="card form">
        <label>
          Customer
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Select a customer…</option>
            {customers?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
          </select>
        </label>

        <h2>Items</h2>
        {lines.map((l, i) => {
          const p = byId.get(l.productId);
          return (
            <div className="line" key={i}>
              <select value={l.productId} onChange={(e) => setLine(i, { productId: Number(e.target.value) })}>
                <option value={0}>Select a product…</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stock === 0}>
                    {p.name} · {fmtMoney(p.price)} · {p.stock} in stock
                  </option>
                ))}
              </select>
              <input type="number" min={1} max={p?.stock ?? 1000} value={l.quantity}
                     onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
              <span className="num">{fmtMoney((p?.price ?? 0) * l.quantity)}</span>
              <button className="link" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</button>
            </div>
          );
        })}
        <button onClick={() => setLines((ls) => [...ls, { productId: 0, quantity: 1 }])}>Add item</button>

        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>
        <div className="row spread">
          <b>Total: {fmtMoney(total)}</b>
          <button className="primary" disabled={!valid || busy} onClick={submit}>{busy ? "Placing…" : "Place order"}</button>
        </div>
        <ErrorText error={error} />
      </section>
    </>
  );
}
