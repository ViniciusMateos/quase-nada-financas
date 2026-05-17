const ICON_TO_EMOJI: Record<string, string> = {
  'shopping-cart': '🛒',
  'utensils': '🍽️',
  'car': '🚗',
  'home': '🏠',
  'heart': '❤️',
  'book': '📚',
  'music': '🎵',
  'shopping-bag': '🛍️',
  'shirt': '👕',
  'wrench': '🔧',
  'repeat': '🔁',
  'trending-up': '📈',
  'dollar-sign': '💲',
  'briefcase': '💼',
  'more-horizontal': '✨',
};

export function categoryEmoji(icon?: string | null): string {
  if (!icon) return '✨';
  if (ICON_TO_EMOJI[icon]) return ICON_TO_EMOJI[icon];
  // já é emoji ou string curta? devolve do jeito que tá.
  if (icon.length <= 2) return icon;
  return '✨';
}
