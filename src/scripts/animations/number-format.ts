const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Agrupa miles con espacio, como el resto de cifras del sitio ("380 000"). */
export function formatGrouped(value: number, decimals = 0) {
  const [int, frac] = Math.abs(value).toFixed(decimals).split('.');
  const grouped = int.length > 3 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : int;
  return `${value < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** Exponente en superíndice Unicode: -32 → "⁻³²". */
export function toSuperscript(value: number) {
  const rounded = Math.round(value);
  const digits = String(Math.abs(rounded))
    .split('')
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)])
    .join('');
  return `${rounded < 0 ? '⁻' : ''}${digits}`;
}
