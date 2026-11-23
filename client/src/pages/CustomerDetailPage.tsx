import { Link, useParams } from "react-router-dom";
import { useFetch } from "../api/useFetch";
import { ErrorText, PageHeader, StatusBadge } from "../components/ui";
import { fmtDate, fmtMoney } from "../format";
import type { Customer, OrderSummary, Page } from "../types";

export function CustomerDetailPage() {
  const { id } = useParams();
  const { data: c, error } = useFetch<Customer>(`/customers/${id}`);
  const { data: orders } = useFetch<Page<OrderSummary>>(`/orders?customerId=${id}&pageSize=50`);

  if (error) return <ErrorText error={error} />;
  if (!c) return <p className="muted">Loading…</p>;

  const spent = (orders?.data ?? []).filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  return (
    <>
      <PageHeader title={c.name} actions={<Link className="button primary" to="/orders/new">New order</Link>} />
      <div className="grid-2">
        <section className="card">
          <h2>Contact</h2>
          <dl>
            <dt>Email</dt><dd>{c.email}</dd>
            <dt>Phone</dt><dd>{c.phone ?? "—"}</dd>
            <dt>Address</dt><dd>{c.address ?? "—"}</dd>
            <dt>Total spent</dt><dd>{fmtMoney(spent)}</dd>
          </dl>
        </section>
        <section className="card">
          <h2>Orders ({orders?.total ?? 0})</h2>
          <table>
            <tbody>
              {orders?.data.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/orders/${o.id}`}>#{o.id}</Link></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="num">{fmtMoney(o.total)}</td>
                  <td>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
