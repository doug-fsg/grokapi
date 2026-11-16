import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dashboards, grokbots } from "@/lib/db/schema";
import { readDashboardSession } from "@/lib/auth/session";
import { dashboardKpis } from "@/lib/dashboard/stats";
import { DashboardGate } from "@/components/dashboard/gate";
import { DashboardView } from "@/components/dashboard/view";

export default async function ClientDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [dash] = await getDb().select().from(dashboards).where(eq(dashboards.slug, slug)).limit(1);
  if (!dash) {
    return (
      <div className="p-10 text-center text-[var(--grokbott-text-secondary)]">
        Dashboard não encontrado.
      </div>
    );
  }
  const session = await readDashboardSession(slug);
  if (!session) {
    return <DashboardGate slug={slug} />;
  }
  const [bot] = await getDb()
    .select()
    .from(grokbots)
    .where(eq(grokbots.id, dash.grokbotId))
    .limit(1);
  const kpis = await dashboardKpis(dash.grokbotId);
  return <DashboardView name={bot?.name ?? "Conta"} kpis={kpis} />;
}
