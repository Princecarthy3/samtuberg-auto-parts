import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingCart, Settings, Mail, Menu, X, LogOut, Shield } from 'lucide-react';

export const Header = () => {
  const {
    cart,
    setIsAdminLoginOpen,
    setIsCartOpen,
  } = useApp();

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="site-header" id="top">
      <div className="header-inner">
        <div className="brand" aria-label="Samtuberg home">
          <span className="brand-mark">ST</span>
          <div className="brand-text">
            <span className="brand-name">Samtuberg</span>
          </div>
        </div>

        <nav className={`main-nav ${isMobileNavOpen ? 'is-open' : ''}`} id="main-nav">
          <a href="#top" onClick={() => setIsMobileNavOpen(false)} className="nav-link-btn">
            <i className="fa-solid fa-house"></i>
            <span>Home</span>
          </a>
          <a href="#about" onClick={() => setIsMobileNavOpen(false)} className="nav-link-btn">
            <i className="fa-solid fa-circle-info"></i>
            <span>About</span>
          </a>
          <a href="#parts" onClick={() => setIsMobileNavOpen(false)} className="nav-link-btn">
            <i className="fa-solid fa-gears"></i>
            <span>Auto Parts</span>
          </a>
          <a href="#cars" onClick={() => setIsMobileNavOpen(false)} className="nav-link-btn">
            <i className="fa-solid fa-car"></i>
            <span>Cars</span>
          </a>
          <a href="#contact" onClick={() => setIsMobileNavOpen(false)} className="nav-link-btn">
            <i className="fa-solid fa-phone"></i>
            <span>Contact</span>
          </a>
        </nav>

        <div className="header-actions">
          <button
            onClick={() => setIsCartOpen(true)}
            className="cart-btn"
            id="cart-btn"
            aria-label="Open cart"
          >
            <i className="fa-solid fa-cart-shopping" aria-hidden="true"></i>
            <span className="cart-badge" id="cart-count">{totalCartItems}</span>
          </button>

          <button
            onClick={() => setIsAdminLoginOpen(true)}
            className="admin-nav-btn"
            aria-label="Admin Portal"
          >
            <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
            <span>Admin</span>
          </button>

          <button className="theme-btn" type="button" aria-label="Switch to dark mode" title="Switch to dark mode">
            <i className="fa-solid fa-moon" aria-hidden="true"></i>
          </button>

          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="nav-toggle"
            id="nav-toggle"
            aria-label="Open menu"
          >
            {isMobileNavOpen ? <i className="fa-solid fa-xmark" aria-hidden="true"></i> : <i className="fa-solid fa-bars" aria-hidden="true"></i>}
          </button>
        </div>
      </div>
    </header>
  );
};
