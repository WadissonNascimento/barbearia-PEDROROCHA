export function buildTrackingUrl(trackingCode: string) {
  const code = trackingCode.trim();

  if (!code) {
    return null;
  }

  return `https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(code)}`;
}
