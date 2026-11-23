import { Link, useSearchParams } from "react-router-dom";
import { qs } from "../api/client";
import { useFetch } from "../api/useFetch";
import { ErrorText, PageHeader, Pager, StatusBadge } from "../components/ui";
import { fmtDate, fmtMoney } from "../format";
import type { OrderSummary, Page } from "../types";

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? 1);
  const { data, error, loading } = useFetch<Page<OrderSummary>>(`/orders${qs({ status, q, page, pageSize: 20 })}`);

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next);
  };

  return (
    <>
      <PageHeader title="Orders" actions={<Link className="button primary" to="/orders/new">New order</Link>} />
      <div className="filters">
        <input placeholder="Search customer or order #" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && update("q", e.currentTarget.value)} />
        <select value={status} onChange={(e) => update("status", e.target.value)}>
          <option value="">All statuses</option>
          {["pending", "processing", "shipped", "delivered", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <ErrorText error={error} />
      <table className={loading ? "loading" : ""}>
        <thead>
          <tr><th>#</th><th>Customer</th><th>Status</th><th>Items</th><th className="num">Total</th><th>Placed</th></tr>
        </thead>
        <tbody>
          {data?.data.map((o) => (
            <tr key={o.id}>
              <td><Link to={`/orders/${o.id}`}>#{o.id}</Link></td>
              <td><Link to={`/customers/${o.customer_id}`}>{o.customer_name}</Link></td>
              <td><StatusBadge status={o.status} /></td>
              <td>{o.item_count}</td>
              <td className="num">{fmtMoney(o.total)}</td>
              <td>{fmtDate(o.created_at)}</td>
            </tr>
          ))}
          {data?.data.length === 0 && <tr><td colSpan={6} className="muted">No orders match.</td></tr>}
        </tbody>
      </table>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update("page", String(p))} />}
    </>
  );
}
