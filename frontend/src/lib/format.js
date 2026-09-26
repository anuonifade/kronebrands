/** Whole dollars stay clean; anything with cents shows both digits, never "$437.5". */
export const money = (cents, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

export const statusLabel = {
  pending_payment: "Awaiting payment",
  paid: "Paid, to fulfil",
  processing: "Being prepared",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
