import nodemailer from "nodemailer";
import { readFile } from "fs/promises";
import { Prisma } from "@prisma/client";
import { getShopAppUrl } from "@/lib/appUrl";
import {
  renderCustomerAppointmentCancelledEmail,
  renderCustomerAppointmentCompletedEmail,
  renderCustomerAppointmentConfirmationEmail,
  renderCustomerAppointmentReminderEmail,
  renderCustomerAppointmentRescheduledEmail,
  renderCustomerPasswordResetEmail,
  renderCustomerVerificationCodeEmail,
  type CustomerAppointmentEmailData,
  type CustomerEmailTheme,
} from "@/lib/email/customerTemplates";
import { basePrisma } from "@/lib/prisma-core";
import { DEFAULT_SHOP_ID, getCurrentShop } from "@/lib/shop";
import { getShopEmailIdentity } from "@/lib/shopEmailIdentity";

const TRANSPARENT_LOGO_DATA_URI = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

export type EmailDeliveryMetadata = Prisma.InputJsonValue;

export type SendEmailMessageInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  template: string;
  eventKey: string;
  shopId?: string;
  recipientUserId?: string | null;
  fromName?: string;
  replyTo?: string;
  metadata?: EmailDeliveryMetadata;
  attachments?: Array<{
    filename: string;
    path: string;
    cid?: string;
  }>;
  maxAttempts?: number;
};

const DEFAULT_SHOP_NAME = "Barbearia";
const DEFAULT_BRAND_COLOR = "#0ea5e9";
const RESEND_EMAIL_API_URL = "https://api.resend.com/emails";

function sanitizeEmailHeaderText(value: string | null | undefined) {
  return value?.replace(/[\r\n<>"]/g, "").trim() || "";
}

function extractEmailAddress(from: string) {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] || from).trim();
}

function formatFromAddress(from: string, fromName?: string) {
  const safeFromName = sanitizeEmailHeaderText(fromName);

  if (safeFromName) {
    return `${safeFromName} <${extractEmailAddress(from)}>`;
  }

  return from.includes("<") ? from : `Atendimento <${from}>`;
}

function resolveEmailLogoUrl(
  logoPath: string | null | undefined,
  shop?: { primaryDomain?: string | null } | null
) {
  const value = logoPath?.trim();

  if (!value) {
    return TRANSPARENT_LOGO_DATA_URI;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const appUrl = getShopAppUrl(shop);
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${appUrl}${normalizedPath}`;
}

function buildCustomerThemeFromShop(shop: {
  name?: string | null;
  primaryDomain?: string | null;
  logoPath?: string | null;
  brandColor?: string | null;
  addressLine?: string | null;
  whatsappNumber?: string | null;
}): CustomerEmailTheme {
  return {
    nomeBarbearia: shop.name?.trim() || DEFAULT_SHOP_NAME,
    logoBarbearia: resolveEmailLogoUrl(shop.logoPath, shop),
    corPrimaria: shop.brandColor?.trim() || DEFAULT_BRAND_COLOR,
    enderecoBarbearia: shop.addressLine || null,
    telefoneBarbearia: shop.whatsappNumber || null,
  };
}

async function getCurrentCustomerEmailTheme() {
  const shop = await getCurrentShop().catch(() => null);
  const emailIdentity = await getShopEmailIdentity(shop?.id);

  return {
    shopId: shop?.id || DEFAULT_SHOP_ID,
    appUrl: getShopAppUrl(shop),
    theme: buildCustomerThemeFromShop({
      name: shop?.name,
      primaryDomain: shop?.primaryDomain,
      logoPath: shop?.logoPath,
      brandColor: shop?.brandColor,
      addressLine: shop?.addressLine,
      whatsappNumber: shop?.whatsappNumber,
    }),
    emailIdentity,
  };
}

function getGlobalMailConfig() {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT || "587");
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASS;
  const from = process.env.EMAIL_FROM || user;

  if (!host || !user || !pass || !from) {
    throw new Error("Configuracao de e-mail incompleta.");
  }

  return {
    host,
    port,
    user,
    pass,
    from,
  };
}

function getEmailProvider() {
  return (process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase();
}

function getResendMailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Configuracao do Resend incompleta.");
  }

  return {
    apiKey,
    from,
  };
}

function shouldUseConsoleMailFallback() {
  return process.env.NODE_ENV !== "production";
}

export function isUsingDevelopmentMailFallback() {
  if (getEmailProvider() === "resend") {
    return shouldUseConsoleMailFallback() && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM);
  }

  const host = process.env.EMAIL_SERVER_HOST;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASS;
  const from = process.env.EMAIL_FROM || user;

  return shouldUseConsoleMailFallback() && (!host || !user || !pass || !from);
}

export function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeEmailError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido.";
}

async function buildResendAttachments(attachments?: SendEmailMessageInput["attachments"]) {
  if (!attachments?.length) {
    return undefined;
  }

  return Promise.all(
    attachments.map(async (attachment) => ({
      filename: attachment.filename,
      content: (await readFile(attachment.path)).toString("base64"),
      content_id: attachment.cid,
    }))
  );
}

function normalizeResendError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as {
    message?: unknown;
    error?: unknown;
    name?: unknown;
  };

  if (typeof data.message === "string") {
    return data.message;
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  if (data.error && typeof data.error === "object" && "message" in data.error) {
    const message = (data.error as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }

  if (typeof data.name === "string") {
    return data.name;
  }

  return null;
}

function getEmailLogWhere({
  shopId,
  template,
  eventKey,
  recipientEmail,
}: {
  shopId: string;
  template: string;
  eventKey: string;
  recipientEmail: string;
}) {
  return {
    shopId_template_eventKey_recipientEmail: {
      shopId,
      template,
      eventKey,
      recipientEmail,
    },
  };
}

async function getExistingSentEmailLog({
  shopId,
  template,
  eventKey,
  recipientEmail,
}: {
  shopId: string;
  template: string;
  eventKey: string;
  recipientEmail: string;
}) {
  try {
    return await basePrisma.emailDeliveryLog.findUnique({
      where: getEmailLogWhere({
        shopId,
        template,
        eventKey,
        recipientEmail,
      }),
      select: {
        id: true,
        status: true,
      },
    });
  } catch (error) {
    console.warn("[email] Nao foi possivel consultar log de envio:", normalizeEmailError(error));
    return null;
  }
}

async function recordEmailDeliveryAttempt({
  shopId,
  recipientUserId,
  recipientEmail,
  template,
  eventKey,
  subject,
  status,
  attempts,
  lastError,
  metadata,
  sentAt,
}: {
  shopId: string;
  recipientUserId?: string | null;
  recipientEmail: string;
  template: string;
  eventKey: string;
  subject: string;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  attempts: number;
  lastError?: string | null;
  metadata?: EmailDeliveryMetadata;
  sentAt?: Date | null;
}) {
  try {
    await basePrisma.emailDeliveryLog.upsert({
      where: getEmailLogWhere({
        shopId,
        template,
        eventKey,
        recipientEmail,
      }),
      create: {
        shopId,
        recipientUserId: recipientUserId || null,
        recipientEmail,
        template,
        eventKey,
        subject,
        status,
        attempts,
        lastError: lastError || null,
        metadata: metadata ?? Prisma.JsonNull,
        sentAt: sentAt || null,
      },
      update: {
        recipientUserId: recipientUserId || null,
        subject,
        status,
        attempts,
        lastError: lastError || null,
        metadata: metadata ?? Prisma.JsonNull,
        sentAt: sentAt || null,
      },
    });
  } catch (error) {
    console.warn("[email] Nao foi possivel gravar log de envio:", normalizeEmailError(error));
  }
}

async function sendMailOnce({
  to,
  subject,
  text,
  html,
  attachments,
  fromName,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: SendEmailMessageInput["attachments"];
  fromName?: string;
  replyTo?: string;
}) {
  if (getEmailProvider() === "resend") {
    await sendResendMailOnce({
      to,
      subject,
      text,
      html,
      attachments,
      fromName,
      replyTo,
    });
    return;
  }

  const config = getGlobalMailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const safeReplyTo = replyTo?.trim();

  await transporter.sendMail({
    from: formatFromAddress(config.from, fromName),
    to,
    subject,
    text,
    html,
    replyTo: safeReplyTo && isValidEmailAddress(safeReplyTo) ? safeReplyTo : undefined,
    attachments: attachments?.length ? attachments : undefined,
  });
}

async function sendResendMailOnce({
  to,
  subject,
  text,
  html,
  attachments,
  fromName,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: SendEmailMessageInput["attachments"];
  fromName?: string;
  replyTo?: string;
}) {
  const config = getResendMailConfig();
  const safeReplyTo = replyTo?.trim();
  const resendAttachments = await buildResendAttachments(attachments);
  const response = await fetch(RESEND_EMAIL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatFromAddress(config.from, fromName),
      to: [to],
      subject,
      html,
      text,
      reply_to:
        safeReplyTo && isValidEmailAddress(safeReplyTo) ? [safeReplyTo] : undefined,
      attachments: resendAttachments,
    }),
  });

  if (!response.ok) {
    let details: unknown = null;

    try {
      details = await response.json();
    } catch {
      details = await response.text().catch(() => null);
    }

    const message = normalizeResendError(details);
    throw new Error(
      message
        ? `Resend ${response.status}: ${message}`
        : `Resend ${response.status}: nao foi possivel enviar o e-mail.`
    );
  }
}

export async function sendEmailMessage({
  to,
  subject,
  text,
  html,
  template,
  eventKey,
  shopId = DEFAULT_SHOP_ID,
  recipientUserId,
  fromName,
  replyTo,
  metadata,
  attachments,
  maxAttempts = 2,
}: SendEmailMessageInput) {
  const recipientEmail = to.trim().toLowerCase();
  const attemptsLimit = Math.max(1, Math.min(maxAttempts, 3));

  if (!isValidEmailAddress(recipientEmail)) {
    await recordEmailDeliveryAttempt({
      shopId,
      recipientUserId,
      recipientEmail,
      template,
      eventKey,
      subject,
      status: "FAILED",
      attempts: 0,
      lastError: "E-mail do destinatario invalido.",
      metadata,
    });

    console.warn(`[email] Destinatario invalido para ${template}: ${recipientEmail}`);
    return { sent: false, skipped: true, attempts: 0 };
  }

  const existingLog = await getExistingSentEmailLog({
    shopId,
    template,
    eventKey,
    recipientEmail,
  });

  if (existingLog?.status === "SENT") {
    console.info(`[email] Envio duplicado ignorado: template=${template} eventKey=${eventKey}`);
    return { sent: false, skipped: true, attempts: 0 };
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attemptsLimit; attempt += 1) {
    await recordEmailDeliveryAttempt({
      shopId,
      recipientUserId,
      recipientEmail,
      template,
      eventKey,
      subject,
      status: "PENDING",
      attempts: attempt - 1,
      metadata,
    });

    try {
      await sendMailOnce({
        to: recipientEmail,
        subject,
        text,
        html,
        attachments,
        fromName,
        replyTo,
      });

      await recordEmailDeliveryAttempt({
        shopId,
        recipientUserId,
        recipientEmail,
        template,
        eventKey,
        subject,
        status: "SENT",
        attempts: attempt,
        metadata,
        sentAt: new Date(),
      });

      console.info(`[email] Enviado: template=${template} to=${recipientEmail}`);
      return { sent: true, skipped: false, attempts: attempt };
    } catch (error) {
      lastError = error;

      if (shouldUseConsoleMailFallback()) {
        logDevelopmentMessageEmail({
          to: recipientEmail,
          subject,
          appointmentCode: eventKey,
        });

        await recordEmailDeliveryAttempt({
          shopId,
          recipientUserId,
          recipientEmail,
          template,
          eventKey,
          subject,
          status: "SENT",
          attempts: attempt,
          metadata,
          sentAt: new Date(),
        });

        return { sent: true, skipped: false, attempts: attempt };
      }
    }
  }

  await recordEmailDeliveryAttempt({
    shopId,
    recipientUserId,
    recipientEmail,
    template,
    eventKey,
    subject,
    status: "FAILED",
    attempts: attemptsLimit,
    lastError: normalizeEmailError(lastError),
    metadata,
  });

  console.warn(
    `[email] Falha final: template=${template} to=${recipientEmail} error=${normalizeEmailError(lastError)}`
  );

  return { sent: false, skipped: false, attempts: attemptsLimit };
}

function logDevelopmentEmail({
  to,
  subject,
  code,
  verifyUrl,
}: {
  to: string;
  subject: string;
  code: string;
  verifyUrl?: string;
}) {
  console.info(
    [
      "[email-dev]",
      `to=${to}`,
      `subject=${subject}`,
      `code=${code}`,
      verifyUrl ? `url=${verifyUrl}` : null,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export type AppointmentCustomerEmailPayload = {
  to: string;
  shopId?: string;
  recipientUserId?: string | null;
  eventKey?: string;
  nomeBarbearia?: string;
  logoBarbearia?: string;
  corPrimaria?: string;
  enderecoBarbearia?: string | null;
  telefoneBarbearia?: string | null;
  customerName: string;
  appointmentCode: string;
  barberName: string;
  serviceName: string;
  serviceMeta: string;
  dateLabel: string;
  timeLabel: string;
  totalLabel: string;
  extrasLabel?: string;
  actionUrl?: string;
  reviewUrl?: string;
  cancellationReason?: string | null;
};

function logDevelopmentMessageEmail({
  to,
  subject,
  appointmentCode,
}: {
  to: string;
  subject: string;
  appointmentCode?: string;
}) {
  console.info(
    [
      "[email-dev]",
      `to=${to}`,
      `subject=${subject}`,
      appointmentCode ? `appointment=${appointmentCode}` : null,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getCustomerThemeFromAppointmentPayload(
  payload: AppointmentCustomerEmailPayload
): CustomerEmailTheme {
  return {
    nomeBarbearia: payload.nomeBarbearia?.trim() || DEFAULT_SHOP_NAME,
    logoBarbearia: payload.logoBarbearia || TRANSPARENT_LOGO_DATA_URI,
    corPrimaria: payload.corPrimaria?.trim() || DEFAULT_BRAND_COLOR,
    enderecoBarbearia: payload.enderecoBarbearia || null,
    telefoneBarbearia: payload.telefoneBarbearia || null,
  };
}

function buildCustomerAppointmentTemplateData(
  payload: AppointmentCustomerEmailPayload
) {
  const theme = getCustomerThemeFromAppointmentPayload(payload);

  return {
    ...theme,
    nomeCliente: payload.customerName?.trim() || "cliente",
    nomeBarbeiro: payload.barberName?.trim() || "barbeiro",
    servico: payload.serviceName?.trim() || "Servico agendado",
    detalhesServico: payload.serviceMeta?.trim() || "Detalhes indisponiveis",
    dataAgendamento: payload.dateLabel?.trim() || "Data indisponivel",
    horarioAgendamento: payload.timeLabel?.trim() || "Horario indisponivel",
    codigoAgendamento: payload.appointmentCode?.trim() || "Sem codigo",
    valorTotal: payload.totalLabel?.trim() || "Valor indisponivel",
    extras: payload.extrasLabel,
    motivoCancelamento: payload.cancellationReason || null,
    linkPainelCliente: payload.actionUrl,
    linkAvaliacao: payload.reviewUrl || payload.actionUrl,
  };
}

async function sendAppointmentCustomerEmail(
  payload: AppointmentCustomerEmailPayload,
  {
    template,
    eventName,
    render,
  }: {
    template: string;
    eventName: string;
    render: (data: CustomerAppointmentEmailData) => {
      subject: string;
      html: string;
      text: string;
    };
  }
) {
  const data = buildCustomerAppointmentTemplateData(payload);
  const rendered = render(data);
  const emailIdentity = await getShopEmailIdentity(payload.shopId);

  await sendEmailMessage({
    to: payload.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template,
    eventKey:
      payload.eventKey ||
      `customer:${eventName}:${payload.appointmentCode || payload.to}`,
    shopId: payload.shopId || DEFAULT_SHOP_ID,
    recipientUserId: payload.recipientUserId || null,
    metadata: {
      appointmentCode: payload.appointmentCode,
      eventName,
    },
    fromName: emailIdentity.fromName,
    replyTo: emailIdentity.replyTo,
  });
}

export async function sendAppointmentConfirmationEmail(
  payload: AppointmentCustomerEmailPayload
) {
  await sendAppointmentCustomerEmail(payload, {
    template: "customer.appointment_confirmation",
    eventName: "appointment_confirmation",
    render: renderCustomerAppointmentConfirmationEmail,
  });
}

export async function sendAppointmentCompletedEmail(
  payload: AppointmentCustomerEmailPayload
) {
  await sendAppointmentCustomerEmail(payload, {
    template: "customer.appointment_completed",
    eventName: "appointment_completed",
    render: renderCustomerAppointmentCompletedEmail,
  });
}

export async function sendAppointmentCancelledEmail(
  payload: AppointmentCustomerEmailPayload
) {
  await sendAppointmentCustomerEmail(payload, {
    template: "customer.appointment_cancelled",
    eventName: "appointment_cancelled",
    render: renderCustomerAppointmentCancelledEmail,
  });
}

export async function sendAppointmentReminderEmail(
  payload: AppointmentCustomerEmailPayload
) {
  await sendAppointmentCustomerEmail(payload, {
    template: "customer.appointment_reminder",
    eventName: "appointment_reminder",
    render: renderCustomerAppointmentReminderEmail,
  });
}

export async function sendAppointmentRescheduledEmail(
  payload: AppointmentCustomerEmailPayload & {
    previousDateTimeLabel: string;
    nextDateTimeLabel: string;
  }
) {
  await sendAppointmentCustomerEmail(payload, {
    template: "customer.appointment_rescheduled",
    eventName: "appointment_rescheduled",
    render: (data) =>
      renderCustomerAppointmentRescheduledEmail({
        ...data,
        horarioAntigo: payload.previousDateTimeLabel,
        novoHorario: payload.nextDateTimeLabel,
      }),
  });
}

export async function sendVerificationCodeEmail({
  to,
  name,
  code,
  verifyUrl,
  accountLabel = "cadastro",
}: {
  to: string;
  name: string;
  code: string;
  verifyUrl?: string;
  accountLabel?: string;
}) {
  const { shopId, theme, emailIdentity } = await getCurrentCustomerEmailTheme();

  if (shouldUseConsoleMailFallback()) {
    logDevelopmentEmail({
      to,
      subject: `Codigo de verificacao - ${theme.nomeBarbearia}`,
      code,
      verifyUrl,
    });
  }

  const rendered = renderCustomerVerificationCodeEmail({
    ...theme,
    nomeCliente: name || "cliente",
    codigoVerificacao: code,
    linkAcao: verifyUrl,
    rotuloAcao: verifyUrl ? "Abrir verificacao" : undefined,
    contexto: accountLabel,
  });

  const result = await sendEmailMessage({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: "customer.email_verification",
    eventKey: `customer:email_verification:${to.trim().toLowerCase()}:${Date.now()}`,
    shopId,
    metadata: {
      accountLabel,
    },
    fromName: emailIdentity.fromName,
    replyTo: emailIdentity.replyTo,
  });

  if (!result.sent) {
    throw new Error("Nao foi possivel enviar o codigo de verificacao.");
  }
}

export async function sendPasswordResetCodeEmail({
  to,
  name,
  code,
}: {
  to: string;
  name: string;
  code: string;
}) {
  const { shopId, appUrl, theme, emailIdentity } = await getCurrentCustomerEmailTheme();

  if (shouldUseConsoleMailFallback()) {
    logDevelopmentEmail({
      to,
      subject: `Recuperacao de senha - ${theme.nomeBarbearia}`,
      code,
    });
  }

  const resetUrl = `${appUrl}/forgot-password/reset?email=${encodeURIComponent(
    to.trim().toLowerCase()
  )}`;
  const rendered = renderCustomerPasswordResetEmail({
    ...theme,
    nomeCliente: name || "cliente",
    codigoVerificacao: code,
    linkAcao: resetUrl,
    rotuloAcao: "Abrir redefinicao",
    contexto: "a recuperacao de senha",
  });

  const result = await sendEmailMessage({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: "customer.password_reset",
    eventKey: `customer:password_reset:${to.trim().toLowerCase()}:${Date.now()}`,
    shopId,
    metadata: {
      resetRequested: true,
    },
    fromName: emailIdentity.fromName,
    replyTo: emailIdentity.replyTo,
  });

  if (!result.sent) {
    throw new Error("Nao foi possivel enviar o codigo de recuperacao.");
  }
}
