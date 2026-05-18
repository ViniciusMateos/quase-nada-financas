/**
 * Mapeamento abreviado MCC (Merchant Category Code) → nome de categoria padrão.
 * Cobre os MCCs mais frequentes em cartões brasileiros. Para MCCs ausentes,
 * a categorização cai no fallback "Outros".
 */
export const MCC_TO_CATEGORY_NAME: Record<string, string> = {
  // Alimentação
  "5411": "Mercado",
  "5422": "Mercado",
  "5499": "Mercado",
  "5812": "Restaurantes",
  "5813": "Restaurantes",
  "5814": "Restaurantes",

  // Transporte
  "4111": "Transporte",
  "4121": "Transporte",
  "4131": "Transporte",
  "5541": "Transporte",
  "5542": "Transporte",
  "7523": "Transporte",

  // Moradia
  "4900": "Moradia",
  "4814": "Moradia",
  "4816": "Moradia",
  "4899": "Moradia",

  // Saúde
  "5912": "Saúde",
  "8011": "Saúde",
  "8021": "Saúde",
  "8042": "Saúde",
  "8062": "Saúde",
  "8099": "Saúde",

  // Educação
  "8220": "Educação",
  "8241": "Educação",
  "8244": "Educação",
  "8249": "Educação",
  "8299": "Educação",

  // Lazer / Entretenimento
  "7832": "Lazer",
  "7929": "Lazer",
  "7991": "Lazer",
  "7994": "Lazer",
  "7997": "Lazer",

  // Compras
  "5311": "Compras",
  "5399": "Compras",
  "5651": "Compras",
  "5691": "Compras",
  "5712": "Compras",
  "5732": "Compras",
  "5942": "Compras",
  "5945": "Compras",

  // Vestuário
  "5611": "Vestuário",
  "5621": "Vestuário",
  "5631": "Vestuário",
  "5641": "Vestuário",
  "5661": "Vestuário",

  // Serviços
  "7210": "Serviços",
  "7230": "Serviços",
  "7298": "Serviços",
  "7299": "Serviços",

  // Assinaturas / Streaming → Serviços (a "aba Assinaturas" é derivada pela analytics)
  "5968": "Serviços",

  // Investimentos
  "6211": "Investimentos",

  // Tarifas bancárias
  "6010": "Tarifas",
  "6011": "Tarifas",
  "6012": "Tarifas",
};
