import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, qs } from "../api/client";
import { useFetch } from "../api/useFetch";
import { useAuth } from "../auth";
import { ErrorText, Modal, PageHeader } from "../components/ui";
import { fmtMoney } from "../format";
import type { Product } from "../types";

export function InventoryPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const low = params.get("low") === "true";
  const q = params.get("q") ?? "";
  const { data, error, reload } = useFetch<Product[]>(`/products${qs({ q, low: low ? "true" : undefined })}`);
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  return (
    <>
      <PageHeader title="Inventory" actions={can("products:write") && <Link className="button primary" to="/inventory/new">Add product</Link>} />
      <div className="filters">
        <input placeholder="Search name or SKU" defaultValue={q}
               onKeyDown={(e) => e.key === "Enter" && setParams(e.currentTarget.value ? { q: e.currentTarget.value } : {})} />
        <label className="check">
          <input type="checkbox" checked={low} onChange={(e) => setParams(e.target.checked ? { low: "true" } : {})} /> Low stock only
        </label>
      </div>
      <ErrorText error={error} />
      <table>
        <thead><tr><th>SKU</th><th>Name</th><th className="num">Price</th><th className="num">Stock</th><th /></tr></thead>
        <tbody>
          {data?.map((p) => (
            <tr key={p.id} className={p.stock <= p.low_stock_threshold ? "low" : ""}>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td className="num">{fmtMoney(p.price)}</td>
              <td className="num">{p.stock}{p.stock <= p.low_stock_threshold && <span className="tag">low</span>}</td>
              <td className="row end">
                {can("inventory:adjust") && <button onClick={() => setAdjusting(p)}>Adjust</button>}
                {can("products:write") && <Link to={`/inventory/${p.id}/edit`}>Edit</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {adjusting && <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} onDone={() => { setAdjusting(null); reload(); }} />}
    </>
  );
}

function AdjustModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/products/${product.id}/adjust`, { delta, reason });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={`Adjust stock · ${product.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">Current stock: {product.stock}. Use a positive number to receive stock and a negative one to write it off.</p>
        <label>Change<input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} /></label>
        <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. PO-1042 received" required minLength={3} /></label>
        <p>New stock: <b>{product.stock + delta}</b></p>
        <ErrorText error={error} />
        <button className="primary" disabled={delta === 0 || product.stock + delta < 0}>Save</button>
      </form>
    </Modal>
  );
}
