import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { AdminSidebar } from "@/components/admin/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { sessionSecret } from "@/lib/env";
import { ensureAdminOperator } from "@/lib/bootstrap";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureAdminOperator();
  const token = (await cookies()).get("grokbott_admin")?.value;
  if (!token) redirect("/login");
  try {
    await jwtVerify(token, new TextEncoder().encode(sessionSecret()));
  } catch {
    redirect("/login");
  }
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-border px-6">
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
