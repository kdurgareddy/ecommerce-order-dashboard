export const ROLES = ["admin", "manager", "support"] as const;
export type Role = (typeof ROLES)[number];

/**
 * What each role may do.
 *   admin   – everything, including user management
 *   manager – run order workflows, manage products and inventory
 *   support – view everything, create customers and orders
 */
export const PERMISSIONS = {
  "users:manage": ["admin"],
  "orders:read": ["admin", "manager", "support"],
  "orders:create": ["admin", "manager", "support"],
  "orders:transition": ["admin", "manager"],
  "orders:cancel": ["admin", "manager"],
  "products:read": ["admin", "manager", "support"],
  "products:write": ["admin", "manager"],
  "inventory:adjust": ["admin", "manager"],
  "customers:read": ["admin", "manager", "support"],
  "customers:write": ["admin", "manager", "support"],
  "stats:read": ["admin", "manager", "support"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
