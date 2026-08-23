// AllergyList — displays a patient's known allergies as styled tags.
// TODO: Add inline editing to add/remove allergies.

import { Tag, Empty } from "antd";
import { WarningOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

interface Props {
  allergies: string[];
}

export function AllergyList({ allergies }: Props) {
  const { t } = useTranslation();
  if (allergies.length === 0) {
    return <Empty description={t("treatment.noAllergies")} />;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {allergies.map((allergy) => (
        <Tag key={allergy} color="red" icon={<WarningOutlined />}>
          {allergy}
        </Tag>
      ))}
    </div>
  );
}
