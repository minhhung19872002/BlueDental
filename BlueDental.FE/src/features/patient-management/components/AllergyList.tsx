// AllergyList — displays a patient's known allergies as styled tags.
// TODO: Add inline editing to add/remove allergies.

import { AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  allergies: string[];
}

export function AllergyList({ allergies }: Props) {
  if (allergies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm gap-2">
        <p>{t("Không có dị ứng đã ghi nhận")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allergies.map((allergy) => (
        <span
          key={allergy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200"
        >
          <AlertTriangle size={12} />
          {allergy}
        </span>
      ))}
    </div>
  );
}
