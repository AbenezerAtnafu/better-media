import type { ReactNode } from "react";

// Reserved route space for future admin surfaces.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
