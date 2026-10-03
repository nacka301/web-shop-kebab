// Sva ograničenja narudžbe na jednom mjestu.
export const MAX_QTY_PER_LINE = 20;
export const MAX_ITEMS_TOTAL = 30;
export const MAX_TOTAL_CENTS = 300 * 100; // 300 EUR
export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const NOTE_MAX = 300;

// Zaštita od spama: najviše RATE_LIMIT_ORDERS narudžbi po IP-u u RATE_LIMIT_WINDOW_MIN minuta.
export const RATE_LIMIT_ORDERS = 5;
export const RATE_LIMIT_WINDOW_MIN = 10;

export const formatEuro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
