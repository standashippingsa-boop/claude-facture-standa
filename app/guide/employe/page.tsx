import OperationsGuide from "@/components/OperationsGuide";

/** Aperçu du manuel employé depuis les paramètres administrateur. */
export default function EmployeeGuidePage() {
  return <OperationsGuide role="employe" backHref="/settings" backLabel="Retour aux paramètres" />;
}
