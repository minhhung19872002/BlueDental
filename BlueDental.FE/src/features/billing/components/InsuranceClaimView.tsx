import { Button, Card, Empty } from "antd";

interface Props {
  patientId: string;
}

export function InsuranceClaimView({ patientId: _patientId }: Props) {
  return (
    <Card title="Bảo hiểm y tế">
      <Empty description="Chưa có yêu cầu bảo hiểm nào">
        <Button type="primary" disabled>
          Tạo yêu cầu
        </Button>
      </Empty>
    </Card>
  );
}
