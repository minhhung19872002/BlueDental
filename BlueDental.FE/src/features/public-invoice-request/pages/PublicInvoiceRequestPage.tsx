import { useState, type ReactNode } from "react";
import { Alert, Spin } from "antd";
import { CheckCircleFilled, ClockCircleOutlined, FileDoneOutlined, DisconnectOutlined } from "@ant-design/icons";
import { useParams } from "react-router-dom";
import { describeApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { formatDateTime, formatMoneyUnit } from "@/utils/format";
import {
  usePublicInvoiceRequestForm,
  useSubmitPublicInvoiceRequest,
  type PublicInvoiceRequestFormDto,
  type PublicInvoiceRequestResultDto,
} from "../api/publicInvoiceRequestApi";
import { PublicInvoiceRequestForm } from "../components/PublicInvoiceRequestForm";
import { toSubmitBody, type PublicInvoiceRequestValues } from "../components/publicInvoiceRequestValues";
import "../components/public-invoice-request.css";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="pir-page">
      <div className="pir-card">{children}</div>
    </main>
  );
}

/** A closed door: broken link, link run out, already answered, or just sent. */
function Notice({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Shell>
      <div className="pir-notice">
        <span className="pir-notice__icon">{icon}</span>
        <h1 className="pir-notice__title">{title}</h1>
        <p className="pir-notice__text">{text}</p>
      </div>
    </Shell>
  );
}

function ReceiptSummary({ form }: { form: PublicInvoiceRequestFormDto }) {
  return (
    <dl className="pir-receipt">
      <div>
        <dt>{t("Patient:InvoiceRequest:Field:Receipt")}</dt>
        <dd>{form.paymentCode}</dd>
      </div>
      <div>
        <dt>{t("Patient:InvoiceRequest:Field:Amount")}</dt>
        <dd>{formatMoneyUnit(form.amount)}</dd>
      </div>
      <div className="pir-receipt__wide">
        <dt>{t("Patient:InvoiceRequest:Field:Service")}</dt>
        <dd>{form.serviceName || "—"}</dd>
      </div>
    </dl>
  );
}

/** The page the QR on a PHIẾU THU opens. No sign-in: the token is the key. */
export function PublicInvoiceRequestPage() {
  const { token = "" } = useParams<{ token: string }>();
  const query = usePublicInvoiceRequestForm(token);
  const submit = useSubmitPublicInvoiceRequest();
  const [result, setResult] = useState<PublicInvoiceRequestResultDto | null>(null);

  const handleSubmit = (values: PublicInvoiceRequestValues) =>
    submit.mutate({ token, body: toSubmitBody(values) }, { onSuccess: setResult });

  if (query.isLoading) {
    return (
      <Shell>
        <div className="pir-loading">
          <Spin />
        </div>
      </Shell>
    );
  }
  if (result) {
    return (
      <Notice
        icon={<CheckCircleFilled />}
        title={t("PublicInvoiceRequest:SuccessTitle")}
        text={t("PublicInvoiceRequest:SuccessText", result.code, formatDateTime(result.dueAt))}
      />
    );
  }
  const form = query.data;
  if (!form) {
    return <Notice icon={<DisconnectOutlined />} title={t("PublicInvoiceRequest:InvalidTitle")} text={t("PublicInvoiceRequest:InvalidText")} />;
  }
  if (form.submitted) {
    return <Notice icon={<FileDoneOutlined />} title={t("PublicInvoiceRequest:SubmittedTitle")} text={t("BlueDental:InvoiceRequest:0013")} />;
  }
  if (form.expired) {
    return <Notice icon={<ClockCircleOutlined />} title={t("PublicInvoiceRequest:ExpiredTitle")} text={t("BlueDental:InvoiceRequest:0012")} />;
  }

  return (
    <Shell>
      <header className="pir-head">
        <p className="pir-head__clinic">{form.clinicName}</p>
        <h1 className="pir-head__title">{t("Patient:InvoiceRequest:SheetTitle")}</h1>
        <p className="pir-head__intro">{t("PublicInvoiceRequest:Intro")}</p>
      </header>
      <ReceiptSummary form={form} />
      {submit.isError && (
        <Alert type="error" showIcon className="pir-error" message={describeApiError(submit.error).message} />
      )}
      <PublicInvoiceRequestForm form={form} submitting={submit.isPending} onSubmit={handleSubmit} />
    </Shell>
  );
}
