const TRANSPARENT_LOGO_DATA_URI = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

export type CustomerEmailTheme = {
  nomeBarbearia: string;
  logoBarbearia?: string;
  corPrimaria: string;
  enderecoBarbearia?: string | null;
  telefoneBarbearia?: string | null;
};

export type CustomerAppointmentEmailData = CustomerEmailTheme & {
  nomeCliente: string;
  nomeBarbeiro: string;
  servico: string;
  detalhesServico: string;
  dataAgendamento: string;
  horarioAgendamento: string;
  codigoAgendamento: string;
  valorTotal: string;
  extras?: string;
  motivoCancelamento?: string | null;
  linkPainelCliente?: string;
  linkAvaliacao?: string;
};

export type CustomerCodeEmailData = CustomerEmailTheme & {
  nomeCliente: string;
  codigoVerificacao: string;
  linkAcao?: string;
  rotuloAcao?: string;
  contexto: string;
};

type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

type EmailLayoutInput = CustomerEmailTheme & {
  eyebrow: string;
  title: string;
  intro: string;
  children: string;
  buttonLabel?: string;
  buttonUrl?: string;
  footerNote?: string;
};

const DEFAULT_BRAND_COLOR = "#b8945f";
const PAGE_BG = "#050403";
const PANEL_BG = "#0b0a08";
const CARD_BG = "#15120f";
const INNER_BG = "#0f0d0a";
const BORDER = "rgba(184, 148, 95, 0.32)";
const SOFT_BORDER = "rgba(255, 255, 255, 0.12)";
const TEXT_MUTED = "#a8a29a";
const TEXT_SOFT = "#d8d2c7";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clean(value: string | null | undefined, fallback = "Não informado") {
  return value?.trim() || fallback;
}

function brandColor(theme: CustomerEmailTheme) {
  return theme.corPrimaria || DEFAULT_BRAND_COLOR;
}

function logoSource(theme: CustomerEmailTheme) {
  return theme.logoBarbearia || TRANSPARENT_LOGO_DATA_URI;
}

export function Button({
  label,
  href,
  color,
}: {
  label: string;
  href: string;
  color: string;
}) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 0;border-collapse:collapse;">
      <tr>
        <td style="border-radius:14px;background:${escapeHtml(color)};box-shadow:0 12px 26px rgba(184,148,95,0.22);">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;color:#0b0a08;text-decoration:none;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function InfoRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:15px 0;border-bottom:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;">
        <p style="margin:0;font-size:11px;line-height:1.4;text-transform:uppercase;letter-spacing:0.16em;color:${TEXT_MUTED};font-weight:800;">
          ${escapeHtml(label)}
        </p>
        <p style="margin:7px 0 0;font-size:18px;line-height:1.35;font-weight:900;color:#fffaf2;">
          ${escapeHtml(value)}
        </p>
      </td>
    </tr>
  `;
}

function InfoCard(rows: Array<[string, string]>) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 0;border-collapse:collapse;border-radius:18px;background:${CARD_BG};border:1px solid ${BORDER};overflow:hidden;">
      <tr>
        <td style="padding:4px 18px 6px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${rows.map(([label, value]) => InfoRow(label, value)).join("")}
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function AppointmentCard(data: CustomerAppointmentEmailData) {
  const rows: Array<[string, string]> = [
    ["Código", clean(data.codigoAgendamento)],
    ["Data", clean(data.dataAgendamento)],
    ["Horário", clean(data.horarioAgendamento)],
    ["Barbeiro", clean(data.nomeBarbeiro)],
    ["Serviço", clean(data.servico)],
    ["Detalhes", clean(data.detalhesServico)],
    ["Total", clean(data.valorTotal)],
  ];

  if (data.extras?.trim()) {
    rows.push(["Extras", data.extras.trim()]);
  }

  return InfoCard(rows);
}

function NoticeBox({
  label,
  value,
  color,
}: {
  label: string;
  value?: string | null;
  color?: string;
}) {
  if (!value?.trim()) {
    return "";
  }

  return `
    <div style="margin:18px 0 0;padding:18px;border-radius:18px;background:${INNER_BG};border:1px solid ${BORDER};">
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;text-transform:uppercase;letter-spacing:0.16em;color:${escapeHtml(color || DEFAULT_BRAND_COLOR)};font-weight:900;">
        ${escapeHtml(label)}
      </p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${TEXT_SOFT};">
        ${escapeHtml(value.trim())}
      </p>
    </div>
  `;
}

export function SecurityCodeBox(code: string, color: string) {
  const digits = code
    .trim()
    .split("")
    .map(
      (digit) => `
        <td style="padding:0 4px;">
          <span style="display:inline-block;width:38px;height:46px;border-radius:12px;background:${INNER_BG};border:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:46px;font-weight:900;text-align:center;color:#fffaf2;">
            ${escapeHtml(digit)}
          </span>
        </td>
      `
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;border-collapse:collapse;border-radius:20px;background:${CARD_BG};border:1px solid ${BORDER};">
      <tr>
        <td align="center" style="padding:22px 16px;">
          <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;text-transform:uppercase;letter-spacing:0.18em;color:${escapeHtml(color)};font-weight:900;">
            Codigo de seguranca
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>${digits}</tr>
          </table>
          <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${TEXT_MUTED};">
            Esse codigo expira em 10 minutos.
          </p>
        </td>
      </tr>
    </table>
  `;
}

export function RatingBox(color: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0;border-collapse:collapse;border-radius:18px;background:${INNER_BG};border:1px solid ${BORDER};">
      <tr>
        <td style="padding:18px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 8px;font-size:11px;line-height:1.4;text-transform:uppercase;letter-spacing:0.16em;color:${escapeHtml(color)};font-weight:900;">
            Avaliacao
          </p>
          <p style="margin:0;font-size:15px;line-height:1.65;color:${TEXT_SOFT};">
            Sua opiniao ajuda a manter o atendimento no padrao da barbearia. A avaliacao leva menos de um minuto.
          </p>
        </td>
      </tr>
    </table>
  `;
}

export function EmailHeader(theme: CustomerEmailTheme) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;">
          <img src="${escapeHtml(logoSource(theme))}" width="96" alt="${escapeHtml(theme.nomeBarbearia)}" style="display:block;width:96px;height:auto;border:0;outline:none;text-decoration:none;" />
        </td>
        <td align="right" style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${TEXT_MUTED};">
          ${escapeHtml(theme.nomeBarbearia)}
        </td>
      </tr>
    </table>
  `;
}

export function EmailFooter(theme: CustomerEmailTheme, note?: string) {
  return `
    <div style="padding-top:18px;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${TEXT_MUTED};">
      ${escapeHtml(note || "Mensagem automatica da plataforma.")}
      ${
        theme.enderecoBarbearia
          ? `<br />${escapeHtml(theme.enderecoBarbearia)}`
          : ""
      }
      ${
        theme.telefoneBarbearia
          ? `<br />Contato: ${escapeHtml(theme.telefoneBarbearia)}`
          : ""
      }
    </div>
  `;
}

export function EmailLayout(input: EmailLayoutInput) {
  const color = brandColor(input);

  return `
    <div style="margin:0;padding:0;background:${PAGE_BG};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${PAGE_BG};">
        <tr>
          <td align="center" style="padding:32px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-collapse:separate;border-spacing:0;">
              <tr>
                <td style="border-radius:30px;background:linear-gradient(135deg,rgba(184,148,95,0.72),rgba(255,255,255,0.14),rgba(184,148,95,0.28));padding:1px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:${PANEL_BG};border-radius:29px;">
                    <tr>
                      <td style="padding:28px 28px 20px;border-radius:29px 29px 0 0;background:linear-gradient(135deg,#050403 0%,#15120f 68%,rgba(184,148,95,0.16) 100%);">
                        ${EmailHeader(input)}
                        <p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;text-transform:uppercase;letter-spacing:0.22em;color:${escapeHtml(color)};font-weight:900;">
                          ${escapeHtml(input.eyebrow)}
                        </p>
                        <h1 style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:1.15;color:#ffffff;">
                          ${escapeHtml(input.title)}
                        </h1>
                        <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${TEXT_SOFT};">
                          ${escapeHtml(input.intro)}
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0 22px 24px;background:${PANEL_BG};">
                        <div style="border-radius:22px;background:${INNER_BG};padding:14px;border:1px solid ${SOFT_BORDER};">
                          ${input.children}
                          ${
                            input.buttonLabel && input.buttonUrl
                              ? Button({
                                  label: input.buttonLabel,
                                  href: input.buttonUrl,
                                  color,
                                })
                              : ""
                          }
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0 28px 28px;border-radius:0 0 29px 29px;background:${PANEL_BG};">
                        ${EmailFooter(input, input.footerNote)}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function lines(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join("\n");
}

function appointmentTextIntro(data: CustomerAppointmentEmailData) {
  return [
    `Codigo: ${data.codigoAgendamento}`,
    `Data: ${data.dataAgendamento}`,
    `Horário: ${data.horarioAgendamento}`,
    `Barbeiro: ${data.nomeBarbeiro}`,
    `Serviço: ${data.servico}`,
    `Detalhes: ${data.detalhesServico}`,
    `Total: ${data.valorTotal}`,
    data.extras ? `Extras: ${data.extras}` : null,
  ];
}

export function renderCustomerAppointmentConfirmationEmail(
  data: CustomerAppointmentEmailData
): RenderedEmail {
  const subject = `Confirmacao de agendamento - ${data.nomeBarbearia}`;

  return {
    subject,
    html: EmailLayout({
      ...data,
      eyebrow: "Agendamento confirmado",
      title: "Seu horário está reservado",
      intro: `Olá, ${data.nomeCliente}. Seu atendimento foi agendado com sucesso.`,
      buttonLabel: "Ver meus agendamentos",
      buttonUrl: data.linkPainelCliente,
      footerNote: "Chegue alguns minutos antes do horário marcado.",
      children: AppointmentCard(data),
    }),
    text: lines([
      `Olá, ${data.nomeCliente}.`,
      "Seu agendamento foi confirmado.",
      ...appointmentTextIntro(data),
      data.linkPainelCliente ? `Ver meus agendamentos: ${data.linkPainelCliente}` : null,
    ]),
  };
}

export function renderCustomerAppointmentCompletedEmail(
  data: CustomerAppointmentEmailData
): RenderedEmail {
  const subject = `Atendimento concluído - ${data.nomeBarbearia}`;

  return {
    subject,
    html: EmailLayout({
      ...data,
      eyebrow: "Atendimento concluído",
      title: "Obrigado pela visita",
      intro: `Olá, ${data.nomeCliente}. Seu atendimento foi finalizado e você já pode avaliar a experiência.`,
      buttonLabel: "Avaliar atendimento",
      buttonUrl: data.linkAvaliacao || data.linkPainelCliente,
      footerNote: "Sua avaliação ajuda a barbearia a manter a qualidade.",
      children: AppointmentCard(data) + RatingBox(brandColor(data)),
    }),
    text: lines([
      `Olá, ${data.nomeCliente}.`,
      "Seu atendimento foi concluído.",
      ...appointmentTextIntro(data),
      data.linkAvaliacao || data.linkPainelCliente
        ? `Avaliar atendimento: ${data.linkAvaliacao || data.linkPainelCliente}`
        : null,
    ]),
  };
}

export function renderCustomerAppointmentCancelledEmail(
  data: CustomerAppointmentEmailData
): RenderedEmail {
  const subject = `Agendamento cancelado - ${data.nomeBarbearia}`;

  return {
    subject,
    html: EmailLayout({
      ...data,
      eyebrow: "Cancelamento",
      title: "Seu horário foi cancelado",
      intro: `Olá, ${data.nomeCliente}. Esse agendamento não está mais ativo.`,
      buttonLabel: "Agendar outro horário",
      buttonUrl: data.linkPainelCliente,
      footerNote: "Se o cancelamento não parece correto, fale com a barbearia.",
      children:
        AppointmentCard(data) +
        NoticeBox({
          label: "Motivo do cancelamento",
          value: data.motivoCancelamento,
          color: "#fda4af",
        }),
    }),
    text: lines([
      `Olá, ${data.nomeCliente}.`,
      "Seu agendamento foi cancelado.",
      ...appointmentTextIntro(data),
      data.motivoCancelamento ? `Motivo: ${data.motivoCancelamento}` : null,
      data.linkPainelCliente ? `Agendar outro horário: ${data.linkPainelCliente}` : null,
    ]),
  };
}

export function renderCustomerAppointmentReminderEmail(
  data: CustomerAppointmentEmailData
): RenderedEmail {
  const subject = `Lembrete do seu atendimento - ${data.nomeBarbearia}`;

  return {
    subject,
    html: EmailLayout({
      ...data,
      eyebrow: "Lembrete",
      title: "Seu atendimento esta próximo",
      intro: `Olá, ${data.nomeCliente}. Faltam cerca de 30 minutos para seu horário.`,
      buttonLabel: "Ver agendamento",
      buttonUrl: data.linkPainelCliente,
      footerNote: "Esse lembrete é automático para ajudar você a chegar no horário.",
      children: AppointmentCard(data),
    }),
    text: lines([
      `Olá, ${data.nomeCliente}.`,
      "Faltam cerca de 30 minutos para seu atendimento.",
      ...appointmentTextIntro(data),
      data.linkPainelCliente ? `Ver agendamento: ${data.linkPainelCliente}` : null,
    ]),
  };
}

export function renderCustomerAppointmentRescheduledEmail(
  data: CustomerAppointmentEmailData & {
    horarioAntigo: string;
    novoHorario: string;
  }
): RenderedEmail {
  const subject = `Agendamento remarcado - ${data.nomeBarbearia}`;

  return {
    subject,
    html: EmailLayout({
      ...data,
      eyebrow: "Reagendamento",
      title: "Seu horário foi alterado",
      intro: `Olá, ${data.nomeCliente}. Confira o novo horário do seu atendimento.`,
      buttonLabel: "Ver agendamento",
      buttonUrl: data.linkPainelCliente,
      footerNote: "Confira a agenda atualizada antes de sair.",
      children:
        InfoCard([
          ["Serviço", clean(data.servico)],
          ["Horário antigo", clean(data.horarioAntigo)],
          ["Novo horário", clean(data.novoHorario)],
          ["Barbeiro", clean(data.nomeBarbeiro)],
        ]) + AppointmentCard(data),
    }),
    text: lines([
      `Olá, ${data.nomeCliente}.`,
      "Seu agendamento foi remarcado.",
      `Horário antigo: ${data.horarioAntigo}`,
      `Novo horário: ${data.novoHorario}`,
      ...appointmentTextIntro(data),
      data.linkPainelCliente ? `Ver agendamento: ${data.linkPainelCliente}` : null,
    ]),
  };
}

export function renderCustomerVerificationCodeEmail(
  data: CustomerCodeEmailData
): RenderedEmail {
  const subject = `Codigo de verificacao - ${data.nomeBarbearia}`;

  return {
    subject,
    html: EmailLayout({
      ...data,
      eyebrow: "Verificação de e-mail",
      title: "Confirme seu acesso",
      intro: `Olá, ${data.nomeCliente}. Use o codigo abaixo para concluir ${data.contexto}.`,
      buttonLabel: data.rotuloAcao,
      buttonUrl: data.linkAcao,
      footerNote: "Se você não solicitou esse código, ignore esta mensagem.",
      children: SecurityCodeBox(data.codigoVerificacao, brandColor(data)),
    }),
    text: lines([
      `Olá, ${data.nomeCliente}.`,
      `Use este codigo para concluir ${data.contexto}: ${data.codigoVerificacao}`,
      "Esse código expira em 10 minutos.",
      data.linkAcao ? `${data.rotuloAcao || "Abrir"}: ${data.linkAcao}` : null,
      "Se você não solicitou esse código, ignore esta mensagem.",
    ]),
  };
}

export function renderCustomerPasswordResetEmail(
  data: CustomerCodeEmailData
): RenderedEmail {
  const subject = `Recuperacao de senha - ${data.nomeBarbearia}`;

  return {
    subject,
    html: EmailLayout({
      ...data,
      eyebrow: "Seguranca da conta",
      title: "Redefina sua senha",
      intro: `Olá, ${data.nomeCliente}. Use o codigo abaixo para criar uma nova senha.`,
      buttonLabel: data.rotuloAcao,
      buttonUrl: data.linkAcao,
      footerNote: "Se você não solicitou a redefinição, ignore esta mensagem.",
      children: SecurityCodeBox(data.codigoVerificacao, brandColor(data)),
    }),
    text: lines([
      `Olá, ${data.nomeCliente}.`,
      `Seu codigo para redefinir a senha e: ${data.codigoVerificacao}`,
      "Esse código expira em 10 minutos.",
      data.linkAcao ? `${data.rotuloAcao || "Abrir"}: ${data.linkAcao}` : null,
      "Se você não solicitou a redefinição, ignore esta mensagem.",
    ]),
  };
}
