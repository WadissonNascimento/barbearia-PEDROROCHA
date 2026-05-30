export type PublicHomeContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryButtonLabel: string;
  primaryButtonHref: string;
  secondaryButtonLabel: string;
  secondaryButtonHref: string;
  infoOneLabel: string;
  infoOneValue: string;
  infoTwoLabel: string;
  infoTwoValue: string;
  infoThreeLabel: string;
  infoThreeValue: string;
  showServices: boolean;
  servicesEyebrow: string;
  servicesTitle: string;
  servicesDescription: string;
  showBarbers: boolean;
  barbersEyebrow: string;
  barbersTitle: string;
  barbersDescription: string;
  showProducts: boolean;
  productsEyebrow: string;
  productsTitle: string;
  productsDescription: string;
  showReviews: boolean;
  reviewsEyebrow: string;
  reviewsTitle: string;
  reviewsEmptyText: string;
  showAbout: boolean;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutBody: string;
  showContact: boolean;
  contactEyebrow: string;
  contactTitle: string;
  contactBody: string;
  footerText: string;
};

export const DEFAULT_PUBLIC_HOME_CONTENT: PublicHomeContent = {
  heroEyebrow: "Barbearia premium",
  heroTitle: "Seu estilo comeca aqui.",
  heroSubtitle:
    "Agende seu horario com praticidade e tenha uma experiencia premium.",
  primaryButtonLabel: "Agendar horario",
  primaryButtonHref: "/agendar",
  secondaryButtonLabel: "Ver servicos",
  secondaryButtonHref: "/servicos",
  infoOneLabel: "Local",
  infoOneValue: "Endereco sob consulta",
  infoTwoLabel: "Horario",
  infoTwoValue: "Horario sob consulta",
  infoThreeLabel: "Atendimento",
  infoThreeValue: "Com hora marcada",
  showServices: true,
  servicesEyebrow: "Servicos",
  servicesTitle: "Escolha seu atendimento.",
  servicesDescription: "Veja os servicos disponiveis e avance para o agendamento.",
  showBarbers: true,
  barbersEyebrow: "Equipe",
  barbersTitle: "Profissionais preparados para seu estilo.",
  barbersDescription: "Escolha o profissional no fluxo de agendamento.",
  showProducts: false,
  productsEyebrow: "Catalogo",
  productsTitle: "Produtos e maquinas em destaque.",
  productsDescription: "Itens disponiveis na barbearia.",
  showReviews: true,
  reviewsEyebrow: "Avaliacoes",
  reviewsTitle: "O que os clientes acharam.",
  reviewsEmptyText:
    "As avaliacoes reais dos clientes vao aparecer aqui depois dos atendimentos concluidos.",
  showAbout: true,
  aboutEyebrow: "Sobre",
  aboutTitle: "Uma barbearia feita para cuidar do seu estilo.",
  aboutBody:
    "Atendimento com hora marcada, cuidado nos detalhes e uma experiencia pensada para voce sair satisfeito.",
  showContact: true,
  contactEyebrow: "Contato",
  contactTitle: "Fale com a barbearia.",
  contactBody: "Use os canais oficiais para tirar duvidas ou combinar detalhes.",
  footerText: "Atendimento profissional com agendamento online.",
};

type NullablePublicHomeContent = Partial<Record<keyof PublicHomeContent, string | boolean | null>>;

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function mergePublicHomeContent(
  content: NullablePublicHomeContent | null | undefined,
  overrides: Partial<PublicHomeContent> = {}
): PublicHomeContent {
  const base = { ...DEFAULT_PUBLIC_HOME_CONTENT, ...overrides };

  return {
    heroEyebrow: stringOrDefault(content?.heroEyebrow, base.heroEyebrow),
    heroTitle: stringOrDefault(content?.heroTitle, base.heroTitle),
    heroSubtitle: stringOrDefault(content?.heroSubtitle, base.heroSubtitle),
    primaryButtonLabel: stringOrDefault(
      content?.primaryButtonLabel,
      base.primaryButtonLabel
    ),
    primaryButtonHref: stringOrDefault(
      content?.primaryButtonHref,
      base.primaryButtonHref
    ),
    secondaryButtonLabel: stringOrDefault(
      content?.secondaryButtonLabel,
      base.secondaryButtonLabel
    ),
    secondaryButtonHref: stringOrDefault(
      content?.secondaryButtonHref,
      base.secondaryButtonHref
    ),
    infoOneLabel: stringOrDefault(content?.infoOneLabel, base.infoOneLabel),
    infoOneValue: stringOrDefault(content?.infoOneValue, base.infoOneValue),
    infoTwoLabel: stringOrDefault(content?.infoTwoLabel, base.infoTwoLabel),
    infoTwoValue: stringOrDefault(content?.infoTwoValue, base.infoTwoValue),
    infoThreeLabel: stringOrDefault(content?.infoThreeLabel, base.infoThreeLabel),
    infoThreeValue: stringOrDefault(content?.infoThreeValue, base.infoThreeValue),
    showServices: booleanOrDefault(content?.showServices, base.showServices),
    servicesEyebrow: stringOrDefault(content?.servicesEyebrow, base.servicesEyebrow),
    servicesTitle: stringOrDefault(content?.servicesTitle, base.servicesTitle),
    servicesDescription: stringOrDefault(
      content?.servicesDescription,
      base.servicesDescription
    ),
    showBarbers: booleanOrDefault(content?.showBarbers, base.showBarbers),
    barbersEyebrow: stringOrDefault(content?.barbersEyebrow, base.barbersEyebrow),
    barbersTitle: stringOrDefault(content?.barbersTitle, base.barbersTitle),
    barbersDescription: stringOrDefault(
      content?.barbersDescription,
      base.barbersDescription
    ),
    showProducts: booleanOrDefault(content?.showProducts, base.showProducts),
    productsEyebrow: stringOrDefault(content?.productsEyebrow, base.productsEyebrow),
    productsTitle: stringOrDefault(content?.productsTitle, base.productsTitle),
    productsDescription: stringOrDefault(
      content?.productsDescription,
      base.productsDescription
    ),
    showReviews: booleanOrDefault(content?.showReviews, base.showReviews),
    reviewsEyebrow: stringOrDefault(content?.reviewsEyebrow, base.reviewsEyebrow),
    reviewsTitle: stringOrDefault(content?.reviewsTitle, base.reviewsTitle),
    reviewsEmptyText: stringOrDefault(
      content?.reviewsEmptyText,
      base.reviewsEmptyText
    ),
    showAbout: booleanOrDefault(content?.showAbout, base.showAbout),
    aboutEyebrow: stringOrDefault(content?.aboutEyebrow, base.aboutEyebrow),
    aboutTitle: stringOrDefault(content?.aboutTitle, base.aboutTitle),
    aboutBody: stringOrDefault(content?.aboutBody, base.aboutBody),
    showContact: booleanOrDefault(content?.showContact, base.showContact),
    contactEyebrow: stringOrDefault(content?.contactEyebrow, base.contactEyebrow),
    contactTitle: stringOrDefault(content?.contactTitle, base.contactTitle),
    contactBody: stringOrDefault(content?.contactBody, base.contactBody),
    footerText: stringOrDefault(content?.footerText, base.footerText),
  };
}
