import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";

const CartContext = createContext(null);
const KEY = "kb_cart_v1";

function reducer(state, action) {
  switch (action.type) {
    case "add": {
      const { item } = action;
      const i = state.findIndex((l) => l.slug === item.slug && l.size === item.size);
      if (i >= 0) return state.map((l, j) => (j === i ? { ...l, quantity: Math.min(10, l.quantity + item.quantity) } : l));
      return [...state, item];
    }
    case "qty":
      return state
        .map((l) => (l.slug === action.slug && l.size === action.size ? { ...l, quantity: action.quantity } : l))
        .filter((l) => l.quantity > 0);
    case "clear":
      return [];
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(reducer, [], () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const value = useMemo(() => ({
    items,
    open,
    setOpen,
    count: items.reduce((n, l) => n + l.quantity, 0),
    subtotal: items.reduce((n, l) => n + l.quantity * l.price_cents, 0),
    add: (item) => { dispatch({ type: "add", item }); setOpen(true); },
    setQty: (slug, size, quantity) => dispatch({ type: "qty", slug, size, quantity }),
    clear: () => dispatch({ type: "clear" }),
  }), [items, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
