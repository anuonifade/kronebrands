import { useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import AdminCustomerDetail from "./admin/AdminCustomerDetail";
import AdminCustomers from "./admin/AdminCustomers";
import AdminDashboard from "./admin/AdminDashboard";
import AdminLayout from "./admin/AdminLayout";
import AdminLogin from "./admin/AdminLogin";
import AdminOrderDetail from "./admin/AdminOrderDetail";
import AdminOrders from "./admin/AdminOrders";
import AdminProductEdit from "./admin/AdminProductEdit";
import AdminProducts from "./admin/AdminProducts";
import AdminSettings from "./admin/AdminSettings";
import AnnouncementBar from "./components/AnnouncementBar";
import CartDrawer from "./components/CartDrawer";
import Footer from "./components/Footer";
import Header from "./components/Header";
import About from "./pages/About";
import Checkout from "./pages/Checkout";
import Home from "./pages/Home";
import Order from "./pages/Order";
import OrderStatus from "./pages/OrderStatus";
import Product from "./pages/Product";
import Shop from "./pages/Shop";

function StoreLayout() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <AnnouncementBar />
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
      <CartDrawer />
    </>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  // The block body matters: current Chrome returns a Promise from scrollTo, and a
  // concise arrow would hand that to React as the effect's cleanup. React calls the
  // cleanup when this unmounts — on every navigation — and blows up the whole tree.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="product/:slug" element={<Product />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:number" element={<Order />} />
          <Route path="order-status" element={<OrderStatus />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<div className="page narrow"><h1 className="h2">Page not found</h1><a href="/shop">Go to the shop</a></div>} />
        </Route>
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:number" element={<AdminOrderDetail />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:email" element={<AdminCustomerDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductEdit />} />
          <Route path="products/:slug" element={<AdminProductEdit />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </>
  );
}
