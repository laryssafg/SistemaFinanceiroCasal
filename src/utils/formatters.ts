export function formatBRL(value: number, showSign = false): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);

  if (value < 0) return `-${formatted}`;
  if (showSign && value > 0) return `+${formatted}`;
  return formatted;
}

export function formatBRLCompact(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2).replace('.', ',')} mi`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1).replace('.', ',')} mil`;
  }
  return formatBRL(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split(/[T ]/)[0].split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function getTimeFromIso(isoDateTime: string): string | null {
  if (!isoDateTime) return null;
  const match = isoDateTime.match(/[T ](\d{2}:\d{2})/);
  return match ? match[1] : null;
}

export function formatDateTimeBR(isoDateTime: string): string {
  if (!isoDateTime) return '—';
  const datePart = isoDateTime.split(/[T ]/)[0];
  const dateFormatted = formatDateBR(datePart);
  const timePart = getTimeFromIso(isoDateTime);
  return timePart ? `${dateFormatted} às ${timePart}` : dateFormatted;
}

export function getLocalDateTimeParts(date = new Date()): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return {
    date: `${y}-${m}-${d}`,
    time: `${hh}:${mm}`,
  };
}
