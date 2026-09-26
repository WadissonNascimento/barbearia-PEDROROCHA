type PresentableService = {
  name: string;
  description?: string | null;
};

const SERVICE_ORDER = [
  "cabelo",
  "sobrancelha",
  "barba",
  "barba + toalha",
  "pezinho",
  "depilacao nariz / orelha",
  "luzes",
  "platinado",
  "relaxamento",
  "progressiva/selagem/botox",
  "hidratacao",
  "cabelo + barba na maquina",
  "cabelo + barba + toalha + depilacao/cera",
  "cabelo + barba + toalha + depilacao/cera + hidratacao",
  "cabelo + relaxamento",
  "cabelo + relaxamento + hidratacao",
  "cabelo + luzes",
  "cabelo + progressiva/selagem/botox",
  "cabelo + platinado",
] as const;

function normalizeServiceName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isComboService(service: PresentableService) {
  return service.description?.trim().toLocaleLowerCase("pt-BR").startsWith("combo") ?? false;
}

export function sortServicesForDisplay<T extends PresentableService>(services: T[]) {
  const priority = new Map<string, number>(
    SERVICE_ORDER.map((name, index) => [name, index])
  );

  return services
    .map((service, originalIndex) => ({ service, originalIndex }))
    .sort((left, right) => {
      const comboDifference =
        Number(isComboService(left.service)) - Number(isComboService(right.service));

      if (comboDifference !== 0) return comboDifference;

      const leftPriority =
        priority.get(normalizeServiceName(left.service.name)) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority =
        priority.get(normalizeServiceName(right.service.name)) ?? Number.MAX_SAFE_INTEGER;

      return leftPriority - rightPriority || left.originalIndex - right.originalIndex;
    })
    .map(({ service }) => service);
}

