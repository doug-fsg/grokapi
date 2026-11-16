import { PageHeader } from "@/components/admin/page-header";
import { WizardForm } from "@/components/wizard/wizard-form";

export default function NewGrokBotPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Novo ManyTalks Bot"
        lede="Sete passos: account, inboxes, pacote, base, kanban, Asaas e dashboard."
      />
      <WizardForm />
    </div>
  );
}
