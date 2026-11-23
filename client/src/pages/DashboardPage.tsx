import { Link } from "react-router-dom";
import { useFetch } from "../api/useFetch";
import { ErrorText, PageHeader, StatusBadge } from "../components/ui";
import { fmtMoney } from "../format";
import type { OrderStatus, Stats } from "../types";

const STATUSES: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled"];

export function DashboardPage() {
  const { data, error } = useFetch<Stats>("/stats");
  if (error) return <ErrorText error={error} />;
  if (!data) return <p className="muted">Loading…</p>;

  const max = Math.max(1, ...data.daily.map((d) => d.revenue));
  return (
    <>
      <PageHeader title="Dashboard" actions={<Link className="button primary" to="/orders/new">New order</Link>} />
      <section className="kpis">
        <Kpi label="Revenue" value={fmtMoney(data.revenue)} />
        <Kpi label="Orders" value={data.orders} />
        <Kpi label="Avg. order value" value={fmtMoney(data.avg_order_value)} />
        <Kpi label="Open orders" value={data.open_orders} to="/orders?status=pending" />
        <Kpi label="Low-stock products" value={data.low_stock_products} to="/inventory?low=true" warn={data.low_stock_products > 0} />
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Revenue, last 14 days</h2>
          <div className="bars" role="img" aria-label="Daily revenue bar chart">
            {data.daily.map((d) => (
              <div key={d.day} className="bar-col" title={`${d.day}: ${fmtMoney(d.revenue)} · ${d.orders} orders`}>
                <div className="bar" style={{ height: `${(d.revenue / max) * 100}%` }} />
                <span>{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Orders by status</h2>
          <ul className="status-list">
            {STATUSES.map((s) => (
              <li key={s}>
                <Link to={`/orders?status=${s}`}><StatusBadge status={s} /></Link>
                <b>{data.by_status[s] ?? 0}</b>
              </li>
            ))}
          </ul>
          <h2>Top products</h2>
          <ol className="top">
            {data.top_products.map((p) => (
              <li key={p.id}>{p.name} <span className="muted">· {p.units} units</span></li>
            ))}
            {data.top_products.length === 0 && <li className="muted">No sales yet</li>}
          </ol>
        </section>
      </div>
    </>
  );
}

function Kpi({ label, value, to, warn }: { label: string; value: string | number; to?: string; warn?: boolean }) {
  const body = (
    <>
      <span>{label}</span>
      <b>{value}</b>
    </>
  );
  return to ? <Link className={`kpi ${warn ? "warn" : ""}`} to={to}>{body}</Link> : <div className="kpi">{body}</div>;
}
