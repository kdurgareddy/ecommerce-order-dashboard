import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { useAuth } from "../auth";
import { ErrorText, PageHeader } from "../components/ui";
import type { User } from "../types";

export function UsersPage() {
  const { user: me } = useAuth();
  const { data, error, reload } = useFetch<User[]>("/users");

  async function toggle(u: User) {
    await api.patch(`/users/${u.id}`, { active: !u.active });
    reload();
  }

  return (
    <>
      <PageHeader title="Users" actions={<Link className="button primary" to="/users/new">Invite user</Link>} />
      <ErrorText error={error} />
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id} className={u.active ? "" : "inactive"}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td><span className={`role role-${u.role}`}>{u.role}</span></td>
              <td>{u.active ? "Active" : "Disabled"}</td>
              <td className="row end">
                <Link to={`/users/${u.id}/edit`}>Edit</Link>
                {u.id !== me?.id && <button className="link" onClick={() => toggle(u)}>{u.active ? "Disable" : "Enable"}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
