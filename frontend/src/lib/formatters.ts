import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatDate = (value: string | Date) =>
  format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });

export const formatDateTime = (value: string | Date) =>
  format(new Date(value), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });

export const currentMonth = () => format(new Date(), 'yyyy-MM');
