import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import OrderView from "./OrderView";

export default function Order() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.lookup(number, params.get("email") || "").then(setOrder).catch((e) => setError(e.message));
  }, [number, params]);

  if (error) return <div className="page narrow"><p className="error">{error}</p><Link to="/order-status">Look up an order</Link></div>;
  if (!order) return <div className="page narrow"><p className="muted">Loading your order…</p></div>;
  return (
    <div className="page narrow">
      <p className="notice">Thank you, {order.full_name.split(" ")[0]}. A confirmation is on its way to {order.email}.</p>
      <OrderView order={order} />
    </div>
  );
}
