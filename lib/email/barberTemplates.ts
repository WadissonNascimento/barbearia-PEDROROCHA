export type BarberEmailTheme = {
  nomeBarbearia: string;
  logoBarbearia?: string;
  corPrimaria: string;
  enderecoBarbearia?: string | null;
  linkPainel: string;
};

export type BarberAppointmentEmailData = BarberEmailTheme & {
  nomeBarbeiro: string;
  nomeCliente: string;
  servico: string;
  dataAgendamento: string;
  horarioAgendamento: string;
  telefoneCliente?: string | null;
  observacoes?: string | null;
};

export type BarberRescheduleEmailData = BarberAppointmentEmailData & {
  horarioAntigo: string;
  novoHorario: string;
};

export type BarberDailyAgendaItem = {
  horario: string;
  cliente: string;
  servico: string;
  telefoneCliente?: string | null;
  observacoes?: string | null;
};

export type BarberDailyAgendaEmailData = BarberEmailTheme & {
  nomeBarbeiro: string;
  dataAgendamento: string;
  quantidadeAtendimentos: number;
  atendimentos: BarberDailyAgendaItem[];
};

export type BarberReviewEmailData = BarberAppointmentEmailData & {
  nota: number;
  comentario?: string | null;
};

type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

type LayoutInput = BarberEmailTheme & {
  eyebrow: string;
  title: string;
  intro: string;
  children: string;
  buttonLabel?: string;
  footerNote?: string;
};

const DEFAULT_DARK = "#020617";
const CARD_DARK = "#0f172a";
const BORDER = "rgba(148, 163, 184, 0.22)";
const TEXT_MUTED = "#94a3b8";
const TEXT_SOFT = "#cbd5e1";
const TRANSPARENT_LOGO_DATA_URI = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clean(value: string | null | undefined, fallback = "Nao informado") {
  return value?.trim() || fallback;
}

function logoSource(theme: BarberEmailTheme) {
  return theme.logoBarbearia || TRANSPARENT_LOGO_DATA_URI;
}

function renderButton(label: string, href: string, color: string) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 0;border-collapse:collapse;">
      <tr>
        <td style="border-radius:14px;background:${escapeHtml(color)};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function renderInfoRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:15px 0;border-bottom:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;">
        <p style="margin:0;font-size:11px;line-height:1.4;text-transform:uppercase;letter-spacing:0.16em;color:${TEXT_MUTED};font-weight:800;">
          ${escapeHtml(label)}
        </p>
        <p style="margin:7px 0 0;font-size:18px;line-height:1.35;font-weight:900;color:#f8fafc;">
          ${escapeHtml(value)}
        </p>
      </td>
    </tr>
  `;
}

function renderInfoCard(rows: Array<[string, string]>) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 0;border-collapse:collapse;border-radius:18px;background:${CARD_DARK};border:1px solid ${BORDER};overflow:hidden;">
      <tr>
        <td style="padding:4px 18px 6px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${rows.map(([label, value]) => renderInfoRow(label, value)).join("")}
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderObservation(label: string, value: string | null | undefined) {
  if (!value?.trim()) {
    return "";
  }

  return `
    <div style="margin:18px 0 0;padding:18px;border-radius:18px;background:#111827;border:1px solid ${BORDER};">
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;text-transform:uppercase;letter-spacing:0.16em;color:#7dd3fc;font-weight:900;">
        ${escapeHtml(label)}
      </p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#e5e7eb;">
        ${escapeHtml(value.trim())}
      </p>
    </div>
  `;
}

function renderAgendaList(items: BarberDailyAgendaItem[]) {
  if (items.length === 0) {
    return `
      <div style="margin:22px 0 0;padding:22px;border-radius:18px;background:${CARD_DARK};border:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;color:${TEXT_SOFT};">
        Nenhum atendimento marcado para hoje.
      </div>
    `;
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 0;border-collapse:separate;border-spacing:0 10px;">
      ${items
        .map(
          (item) => `
            <tr>
              <td style="padding:16px;border-radius:18px;background:${CARD_DARK};border:1px solid ${BORDER};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="width:78px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1;font-weight:900;color:#f8fafc;">
                      ${escapeHtml(item.horario)}
                    </td>
                    <td style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;">
                      <p style="margin:0;font-size:16px;line-height:1.35;font-weight:900;color:#ffffff;">
                        ${escapeHtml(item.cliente)}
                      </p>
                      <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${TEXT_SOFT};">
                        ${escapeHtml(item.servico)}
                      </p>
                      ${
                        item.telefoneCliente
                          ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${TEXT_MUTED};">${escapeHtml(item.telefoneCliente)}</p>`
                          : ""
                      }
                      ${
                        item.observacoes
                          ? `<p style="margin:8px 0 0;padding-top:8px;border-top:1px solid ${BORDER};font-size:13px;line-height:1.5;color:${TEXT_SOFT};">${escapeHtml(item.observacoes)}</p>`
                          : ""
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `
        )
        .join("")}
    </table>
  `;
}

function renderLayout(input: LayoutInput) {
  return `
    <div style="margin:0;padding:0;background:#030712;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#030712;">
        <tr>
          <td align="center" style="padding:32px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-collapse:separate;border-spacing:0;">
              <tr>
                <td style="border-radius:30px;background:linear-gradient(135deg,rgba(148,163,184,0.35),rgba(14,165,233,0.28),rgba(148,163,184,0.14));padding:1px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:${DEFAULT_DARK};border-radius:29px;">
                    <tr>
                      <td style="padding:28px 28px 20px;border-radius:29px 29px 0 0;background:linear-gradient(135deg,#020617 0%,#0f172a 62%,rgba(14,165,233,0.22) 100%);">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;">
                              <img src="${escapeHtml(logoSource(input))}" width="82" alt="${escapeHtml(input.nomeBarbearia)}" style="display:block;width:82px;height:auto;border:0;outline:none;text-decoration:none;" />
                            </td>
                            <td align="right" style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${TEXT_MUTED};">
                              ${escapeHtml(input.nomeBarbearia)}
                            </td>
                          </tr>
                        </table>
                        <p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;text-transform:uppercase;letter-spacing:0.22em;color:${escapeHtml(input.corPrimaria)};font-weight:900;">
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
                      <td style="padding:0 22px 24px;background:${DEFAULT_DARK};">
                        <div style="border-radius:22px;background:#050b16;padding:14px;border:1px solid rgba(148,163,184,0.14);">
                          ${input.children}
                          ${
                            input.buttonLabel
                              ? renderButton(input.buttonLabel, input.linkPainel, input.corPrimaria)
                              : ""
                          }
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0 28px 28px;border-radius:0 0 29px 29px;background:${DEFAULT_DARK};">
                        <div style="padding-top:18px;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${TEXT_MUTED};">
                          ${escapeHtml(input.footerNote || "Mensagem automatica da plataforma.")}
                          ${
                            input.enderecoBarbearia
                              ? `<br />${escapeHtml(input.enderecoBarbearia)}`
                              : ""
                          }
                        </div>
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

function textLines(lines: Array<string | null | undefined>) {
  return lines.filter(Boolean).join("\n");
}

function appointmentRows(data: BarberAppointmentEmailData) {
  return [
    ["Cliente", clean(data.nomeCliente)],
    ["Telefone", clean(data.telefoneCliente)],
    ["Servico", clean(data.servico)],
    ["Data", clean(data.dataAgendamento)],
    ["Horario", clean(data.horarioAgendamento)],
  ] as Array<[string, string]>;
}

export function renderBarberNewAppointmentEmail(
  data: BarberAppointmentEmailData
): RenderedEmail {
  const subject = `Novo agendamento - ${data.nomeCliente} as ${data.horarioAgendamento}`;

  return {
    subject,
    html: renderLayout({
      ...data,
      eyebrow: "Novo agendamento",
      title: "Voce tem um novo horario",
      intro: `${data.nomeCliente} acabou de agendar um atendimento com voce.`,
      buttonLabel: "Abrir Agenda",
      footerNote: "Confira os detalhes no painel antes do atendimento.",
      children:
        renderInfoCard(appointmentRows(data)) +
        renderObservation("Observacoes do cliente", data.observacoes),
    }),
    text: textLines([
      `Novo agendamento em ${data.nomeBarbearia}`,
      `Barbeiro: ${data.nomeBarbeiro}`,
      `Cliente: ${data.nomeCliente}`,
      `Telefone: ${clean(data.telefoneCliente)}`,
      `Servico: ${data.servico}`,
      `Data: ${data.dataAgendamento}`,
      `Horario: ${data.horarioAgendamento}`,
      data.observacoes ? `Observacoes: ${data.observacoes}` : null,
      `Abrir agenda: ${data.linkPainel}`,
    ]),
  };
}

export function renderBarberAppointmentCancelledEmail(
  data: BarberAppointmentEmailData & { motivoCancelamento?: string | null }
): RenderedEmail {
  const subject = `Agendamento cancelado - ${data.nomeCliente}`;

  return {
    subject,
    html: renderLayout({
      ...data,
      eyebrow: "Cancelamento",
      title: "Um horario foi cancelado",
      intro: `O atendimento de ${data.nomeCliente} saiu da sua agenda.`,
      buttonLabel: "Abrir Agenda",
      footerNote: "O historico continua registrado no painel.",
      children:
        renderInfoCard(appointmentRows(data)) +
        renderObservation("Motivo do cancelamento", data.motivoCancelamento),
    }),
    text: textLines([
      `Agendamento cancelado em ${data.nomeBarbearia}`,
      `Barbeiro: ${data.nomeBarbeiro}`,
      `Cliente: ${data.nomeCliente}`,
      `Servico: ${data.servico}`,
      `Data: ${data.dataAgendamento}`,
      `Horario: ${data.horarioAgendamento}`,
      data.motivoCancelamento ? `Motivo: ${data.motivoCancelamento}` : null,
      `Abrir agenda: ${data.linkPainel}`,
    ]),
  };
}

export function renderBarberAppointmentRescheduledEmail(
  data: BarberRescheduleEmailData
): RenderedEmail {
  const subject = `Agendamento remarcado - ${data.nomeCliente}`;

  return {
    subject,
    html: renderLayout({
      ...data,
      eyebrow: "Reagendamento",
      title: "Um horario foi alterado",
      intro: `O atendimento de ${data.nomeCliente} recebeu uma nova data ou horario.`,
      buttonLabel: "Abrir Agenda",
      footerNote: "Confira a agenda atualizada antes de organizar o dia.",
      children:
        renderInfoCard([
          ["Cliente", clean(data.nomeCliente)],
          ["Servico", clean(data.servico)],
          ["Horario antigo", clean(data.horarioAntigo)],
          ["Novo horario", clean(data.novoHorario)],
          ["Telefone", clean(data.telefoneCliente)],
        ]) + renderObservation("Observacoes", data.observacoes),
    }),
    text: textLines([
      `Agendamento remarcado em ${data.nomeBarbearia}`,
      `Barbeiro: ${data.nomeBarbeiro}`,
      `Cliente: ${data.nomeCliente}`,
      `Servico: ${data.servico}`,
      `Horario antigo: ${data.horarioAntigo}`,
      `Novo horario: ${data.novoHorario}`,
      `Abrir agenda: ${data.linkPainel}`,
    ]),
  };
}

export function renderBarberDailyAgendaEmail(
  data: BarberDailyAgendaEmailData
): RenderedEmail {
  const subject = `Agenda do dia - ${data.quantidadeAtendimentos} atendimento(s)`;

  return {
    subject,
    html: renderLayout({
      ...data,
      eyebrow: "Agenda do dia",
      title: `${data.quantidadeAtendimentos} atendimento(s) hoje`,
      intro: `Bom dia, ${data.nomeBarbeiro}. Esta e sua agenda organizada para ${data.dataAgendamento}.`,
      buttonLabel: "Abrir Agenda",
      footerNote: "Use esse resumo para preparar o dia com calma.",
      children: renderAgendaList(data.atendimentos),
    }),
    text: textLines([
      `Agenda do dia - ${data.nomeBarbearia}`,
      `Barbeiro: ${data.nomeBarbeiro}`,
      `Data: ${data.dataAgendamento}`,
      `Atendimentos: ${data.quantidadeAtendimentos}`,
      "",
      ...data.atendimentos.map(
        (item) =>
          `${item.horario} - ${item.cliente} - ${item.servico}${
            item.telefoneCliente ? ` - ${item.telefoneCliente}` : ""
          }${item.observacoes ? ` - Obs.: ${item.observacoes}` : ""}`
      ),
      `Abrir agenda: ${data.linkPainel}`,
    ]),
  };
}

export function renderBarberNoShowEmail(
  data: BarberAppointmentEmailData
): RenderedEmail {
  const subject = `Cliente nao compareceu - ${data.nomeCliente}`;

  return {
    subject,
    html: renderLayout({
      ...data,
      eyebrow: "Nao compareceu",
      title: "Atendimento marcado como falta",
      intro: `${data.nomeCliente} foi marcado como nao compareceu.`,
      buttonLabel: "Abrir Agenda",
      footerNote: "Esse registro ajuda a manter o historico do cliente claro.",
      children: renderInfoCard(appointmentRows(data)),
    }),
    text: textLines([
      `Cliente nao compareceu em ${data.nomeBarbearia}`,
      `Barbeiro: ${data.nomeBarbeiro}`,
      `Cliente: ${data.nomeCliente}`,
      `Servico: ${data.servico}`,
      `Data: ${data.dataAgendamento}`,
      `Horario: ${data.horarioAgendamento}`,
      `Abrir agenda: ${data.linkPainel}`,
    ]),
  };
}

export function renderBarberNewReviewEmail(
  data: BarberReviewEmailData
): RenderedEmail {
  const subject = `Nova avaliacao recebida - ${data.nota}/5`;

  return {
    subject,
    html: renderLayout({
      ...data,
      eyebrow: "Nova avaliacao",
      title: `${data.nota}/5 recebido`,
      intro: `${data.nomeCliente} avaliou o atendimento realizado.`,
      buttonLabel: "Ver Avaliacoes",
      footerNote: "Avaliacoes ajudam a acompanhar qualidade e experiencia do cliente.",
      children:
        renderInfoCard([
          ["Cliente", clean(data.nomeCliente)],
          ["Servico", clean(data.servico)],
          ["Nota", `${data.nota}/5`],
          ["Data", clean(data.dataAgendamento)],
          ["Horario", clean(data.horarioAgendamento)],
        ]) + renderObservation("Comentario", data.comentario),
    }),
    text: textLines([
      `Nova avaliacao em ${data.nomeBarbearia}`,
      `Barbeiro: ${data.nomeBarbeiro}`,
      `Cliente: ${data.nomeCliente}`,
      `Servico: ${data.servico}`,
      `Nota: ${data.nota}/5`,
      data.comentario ? `Comentario: ${data.comentario}` : null,
      `Ver avaliacoes: ${data.linkPainel}`,
    ]),
  };
}
