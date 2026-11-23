import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { useAuth } from "../auth";
import { ErrorText, PageHeader, StatusBadge } from "../components/ui";
import { fmtDate, fmtMoney } from "../format";
import type { OrderDetail, OrderStatus } from "../types";

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  processing: "Start processing",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
};

export function OrderDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data: order, error, setData } = useFetch<OrderDetail>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function act(path: string, body: object) {
    setBusy(true);
    setActionError(null);
    try {
      setData(await api.post<OrderDetail>(`/orders/${id}/${path}`, { ...body, note: note || undefined }));
      setNote("");
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorText error={error} />;
  if (!order) return <p className="muted">Loading…</p>;

  const forward = order.next_statuses.filter((s) => s !== "cancelled");
  const canCancel = order.next_statuses.includes("cancelled") && can("orders:cancel");

  return (
    <>
      <PageHeader title={`Order #${order.id}`} actions={<StatusBadge status={order.status} />} />
      <div className="grid-2">
        <section className="card">
          <h2>Items</h2>
          <table>
            <thead><tr><th>SKU</th><th>Product</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Total</th></tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.sku}</td><td>{i.name}</td><td className="num">{i.quantity}</td>
                  <td className="num">{fmtMoney(i.unit_price)}</td><td className="num">{fmtMoney(i.line_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4}>Order total</td><td className="num"><b>{fmtMoney(order.total)}</b></td></tr></tfoot>
          </table>
          {order.notes && <p><b>Notes:</b> {order.notes}</p>}
        </section>

        <section className="card">
          <h2>Customer</h2>
          <p><Link to={`/customers/${order.customer_id}`}>{order.customer_name}</Link><br /><span className="muted">{order.customer_email}</span></p>

          {(forward.length > 0 || canCancel) && can("orders:transition") && (
            <>
              <h2>Actions</h2>
              <input placeholder="Optional note (tracking #, reason…)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row">
                {forward.map((s) => (
                  <button key={s} className="primary" disabled={busy} onClick={() => act("status", { status: s })}>
                    {ACTION_LABEL[s] ?? s}
                  </button>
                ))}
                {canCancel && (
                  <button className="danger" disabled={busy} onClick={() => confirm("Cancel this order and restock its items?") && act("cancel", {})}>
                    Cancel &amp; restock
                  </button>
                )}
              </div>
              <ErrorText error={actionError} />
            </>
          )}

          <h2>Timeline</h2>
          <ol className="timeline">
            {order.events.map((e) => (
              <li key={e.id}>
                <StatusBadge status={e.to_status} /> <span className="muted">{fmtDate(e.created_at)} · {e.user_name ?? "system"}</span>
                {e.note && <div>{e.note}</div>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
