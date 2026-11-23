import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export function Layout() {
  const { user, logout, can } = useAuth();
  const links = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/orders", label: "Orders" },
    { to: "/orders/new", label: "New order" },
    { to: "/inventory", label: "Inventory" },
    { to: "/customers", label: "Customers" },
    ...(can("users:manage") ? [{ to: "/users", label: "Users" }] : []),
  ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">OrderDesk</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <NavLink to="/account">
            {user?.name}
            <small>{user?.role}</small>
          </NavLink>
          <button className="link" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
