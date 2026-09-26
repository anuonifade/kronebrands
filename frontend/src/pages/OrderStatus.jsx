import { useState } from "react";
import { api } from "../lib/api";
import OrderView from "./OrderView";

export default function OrderStatus() {
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try { setOrder(await api.lookup(number, email)); } catch (err) { setOrder(null); setError(err.message); }
  };

  return (
    <div className="page narrow">
      {!order && (
        <form onSubmit={submit} className="lookup">
          <h1 className="display display--md">Order status</h1>
          <p className="muted">Enter the order number from your confirmation email (it starts with KB-).</p>
          <label className="field"><span>Order number</span><input value={number} onChange={(e) => setNumber(e.target.value)} required placeholder="KB-7Q2M4X" /></label>
          <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn">Find my order</button>
        </form>
      )}
      {order && <><OrderView order={order} /><button className="linkbtn" onClick={() => setOrder(null)}>Look up another order</button></>}
    </div>
  );
}
