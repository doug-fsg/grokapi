import { GrokbotDetail } from "@/components/admin/grokbot-detail";

export default async function GrokbotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GrokbotDetail id={id} />;
}
