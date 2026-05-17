/**
 * 15 categorias padrão do MVP. IDs fixos para permitir referência estável
 * pelos seeds e pela tabela MCC → categoria.
 */
export interface SeedCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Mercado",        icon: "shopping-cart",  color: "#22C55E" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Restaurantes",   icon: "utensils",       color: "#EF4444" },
  { id: "00000000-0000-4000-8000-000000000003", name: "Transporte",     icon: "car",            color: "#3B82F6" },
  { id: "00000000-0000-4000-8000-000000000004", name: "Moradia",        icon: "home",           color: "#8B5CF6" },
  { id: "00000000-0000-4000-8000-000000000005", name: "Saúde",          icon: "heart",          color: "#EC4899" },
  { id: "00000000-0000-4000-8000-000000000006", name: "Educação",       icon: "book",           color: "#F59E0B" },
  { id: "00000000-0000-4000-8000-000000000007", name: "Lazer",          icon: "music",          color: "#06B6D4" },
  { id: "00000000-0000-4000-8000-000000000008", name: "Compras",        icon: "shopping-bag",   color: "#A855F7" },
  { id: "00000000-0000-4000-8000-000000000009", name: "Vestuário",      icon: "shirt",          color: "#F472B6" },
  { id: "00000000-0000-4000-8000-00000000000A", name: "Serviços",       icon: "wrench",         color: "#64748B" },
  { id: "00000000-0000-4000-8000-00000000000B", name: "Assinaturas",    icon: "repeat",         color: "#0EA5E9" },
  { id: "00000000-0000-4000-8000-00000000000C", name: "Investimentos",  icon: "trending-up",    color: "#10B981" },
  { id: "00000000-0000-4000-8000-00000000000D", name: "Tarifas",        icon: "dollar-sign",    color: "#9CA3AF" },
  { id: "00000000-0000-4000-8000-00000000000E", name: "Salário",        icon: "briefcase",      color: "#16A34A" },
  { id: "00000000-0000-4000-8000-00000000000F", name: "Outros",             icon: "more-horizontal", color: "#6B7280" },
  { id: "00000000-0000-4000-8000-000000000010", name: "Pagamento de fatura", icon: "repeat",          color: "#94A3B8" },
];

/** Transferência interna conta↔cartão. Excluída dos summaries. */
export const INTERNAL_TRANSFER_CATEGORY_ID = "00000000-0000-4000-8000-000000000010";
