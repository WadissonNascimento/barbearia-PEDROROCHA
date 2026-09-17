// Only controlled messages reach the customer: never echo provider payloads,
// which may contain personal data or submitted card details.
export function getVipBillingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/não autorizad|nao autorizad|recusad|credit.?card|cartão.*inválid|cartao.*invalid/i.test(message)) {
    return "O cartão não foi autorizado. Confira os dados, tente outro cartão ou escolha Pix/boleto. Se os dados estiverem corretos, consulte o banco emissor.";
  }
  if (/cpf|cnpj|documento/i.test(message)) {
    return "O CPF/CNPJ não foi aceito. Confira o documento informado e tente novamente.";
  }
  if (/pix|habilitad|liberad|conta.*aprov/i.test(message)) {
    return "Essa forma de pagamento ainda não está disponível na conta da barbearia. Escolha outra opção ou fale com a barbearia.";
  }
  return "Não foi possível concluir a atualização. Tente novamente; as mensalidades já pagas serão preservadas. Se persistir, fale com a barbearia.";
}
