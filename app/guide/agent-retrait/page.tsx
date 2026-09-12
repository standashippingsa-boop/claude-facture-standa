import OperationsGuide from "@/components/OperationsGuide";

/** Aperçu du manuel de point de retrait depuis les paramètres administrateur. */
export default function PickupGuidePreviewPage() {
  return <OperationsGuide role="agent_retrait" backHref="/settings" backLabel="Retour aux paramètres" />;
}
