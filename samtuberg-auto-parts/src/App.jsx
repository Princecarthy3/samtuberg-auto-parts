import React from 'react';

export default function App() {
  return (
    <>
      <header className="site-header" id="top">
        <div className="header-inner">
          <nav className="main-nav" id="main-nav">
            <a href="./" className="nav-link-btn" data-page="home"><i className="fa-solid fa-house"></i> <span>Home</span></a>
            <a href="#about" className="nav-link-btn" data-page="about"><i className="fa-solid fa-circle-info"></i> <span>About</span></a>
            <a href="#parts" className="nav-link-btn" data-page="parts"><i className="fa-solid fa-gears"></i> <span>Auto Parts</span></a>
            <a href="#cars" className="nav-link-btn" data-page="cars"><i className="fa-solid fa-car"></i> <span>Cars</span></a>
            <a href="#contact" className="nav-link-btn" data-page="contact"><i className="fa-solid fa-phone"></i> <span>Contact</span></a>
          </nav>

          <button className="nav-toggle" id="nav-toggle" aria-label="Open menu" aria-expanded="false">
            <i className="fa-solid fa-bars" aria-hidden="true"></i>
          </button>

          <a className="mobile-brand" href="./" data-page="home" aria-label="Samtuberg Auto Parts and Cars home">
            <span className="mobile-brand-mark">ST</span>
            <span className="mobile-brand-name">Samtuberg</span>
          </a>

          <div className="header-actions">
            <button className="cart-btn" id="cart-btn" aria-label="Open cart">
              <i className="fa-solid fa-cart-shopping" aria-hidden="true"></i>
              <span className="cart-badge" id="cart-count">0</span>
            </button>
            <button className="admin-nav-btn" id="admin-login-btn" aria-label="Admin Portal">
              <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
              <span id="admin-btn-text">Admin</span>
            </button>
            <button className="theme-btn" id="theme-btn" type="button" aria-label="Switch to dark mode" title="Switch to dark mode">
              <i className="fa-solid fa-moon" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </header>

      <div className="nav-backdrop" id="nav-backdrop" aria-hidden="true"></div>

      <main>
        <section className="hero" id="hero">
          <div className="hero-backdrop-glow"></div>
          <div className="hero-inner">
            <div className="hero-badge">
              <span className="badge-pulse"></span>
              <i className="fa-solid fa-shield-halved"></i>
              <span>GENUINE BODY PARTS &bull; TRUSTED USED CARS &bull; GHANA</span>
            </div>

            <h1 className="hero-title">
              <span className="title-line title-white">STRIP IT.</span><br />
              <span className="title-line title-silver">SWAP IT.</span><br />
              <span className="title-line title-gold">ROAD READY.</span>
            </h1>

            <p className="hero-sub">
              Samtuberg deals mainly in quality auto body parts — bumpers, headlights,
              taillights, shells and panels for the makes Ghana drives most — plus a
              short list of clean, ready-to-drive used cars. All prices shown in GH₵.
            </p>

            <div className="hero-actions">
              <a href="#parts" className="btn btn-primary btn-hero-primary"><i className="fa-solid fa-car-side"></i> Browse Auto Parts</a>
              <a href="#cars" id="view-cars-btn" className="btn btn-primary btn-hero-primary"><i className="fa-solid fa-car"></i> View Cars For Sale</a>
            </div>
          </div>

          <div className="spec-strip">
            <div className="spec-item">
              <div className="spec-icon-wrap"><i className="fa-solid fa-car-side" aria-hidden="true"></i></div>
              <div>
                <strong>Genuine Body Parts</strong>
                <span>Bumpers &bull; Headlights &bull; Taillights &bull; Shells</span>
              </div>
            </div>
            <div className="spec-item">
              <div className="spec-icon-wrap"><i className="fa-solid fa-location-dot" aria-hidden="true"></i></div>
              <div>
                <strong>Nationwide Delivery</strong>
                <span>Serving Accra, Kumasi, Takoradi &amp; all of Ghana</span>
              </div>
            </div>
          </div>
        </section>

        <section className="about" id="about">
          <div className="about-inner">
            <p className="section-eyebrow">About Samtuberg</p>
            <h2 className="section-title">Parts first. Cars second. Trust always.</h2>
            <p className="about-text">
              Samtuberg Auto Parts &amp; Cars Company is built around one job: getting you the exact body part your vehicle needs, at a fair price in Ghana Cedis. Our shelves are stocked mainly with bumpers, headlights, taillights, and full body shells — front fenders, doors, bonnets and trunk lids — pulled and graded for the makes and models most common on Ghanaian roads. Alongside the parts, we also keep a small, hand-picked selection of used cars for customers ready to buy a full vehicle rather than repair one.
            </p>
            <div className="about-grid">
              <div className="about-card">
                <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
                <h3>Parts, mostly</h3>
                <p>The bulk of our stock is body parts, not full cars — that is where our expertise is.</p>
              </div>
              <div className="about-card">
                <i className="fa-solid fa-money-bill-wave" aria-hidden="true"></i>
                <h3>Priced in cedis</h3>
                <p>Every listing shows the exact model year it fits and its price in GH₵, upfront.</p>
              </div>
              <div className="about-card">
                <i className="fa-solid fa-envelope-open-text" aria-hidden="true"></i>
                <h3>Order by email</h3>
                <p>Build your cart, send it straight to our inbox, and we will confirm availability.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="catalog-section" id="parts">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">Our main business</p>
              <h2 className="section-title">Auto parts</h2>
            </div>
            <p className="section-sub">Bumpers, headlights, taillights, shells and more — search or filter by category below.</p>
          </div>

          <div className="parts-toolbar">
            <div className="parts-filter" id="parts-filter" aria-label="Parts categories">
              <button className="filter-btn is-active" data-filter="all" type="button">All Parts</button>
              <button className="filter-btn" data-filter="bumpers" type="button">Bumpers</button>
              <button className="filter-btn" data-filter="headlights" type="button">Headlights</button>
              <button className="filter-btn" data-filter="taillights" type="button">Taillights</button>
              <button className="filter-btn" data-filter="shells" type="button">Shells &amp; Panels</button>
              <button className="filter-btn" data-filter="mirrors" type="button">Mirrors</button>
              <button className="filter-btn" data-filter="grilles" type="button">Grilles</button>
              <button className="filter-btn" data-filter="foglights" type="button">Fog Lights &amp; DRLs</button>
              <button className="filter-btn" data-filter="bodykits" type="button">Body Kits</button>
            </div>

            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input id="parts-search" type="search" placeholder="Search parts or fitment" aria-label="Search parts" />
              <button type="button" id="parts-search-clear" className="search-clear" aria-label="Clear search">×</button>
            </div>
          </div>

          <div className="catalog-grid" id="parts-grid" aria-live="polite"></div>
        </section>

        <section className="catalog-section cars-section" id="cars">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">Used cars</p>
              <h2 className="section-title">Cars for sale</h2>
            </div>
            <p className="section-sub">Clean, ready-to-drive vehicles selected for value and reliability.</p>
          </div>
          <div className="catalog-grid" id="cars-grid" aria-live="polite"></div>
        </section>

        <section className="trust-section" id="trust">
          <div className="trust-inner">
            <p className="section-eyebrow">Why choose us</p>
            <h2 className="section-title">The Samtuberg quality standard</h2>
            <div className="trust-grid">
              <div className="trust-card">
                <i className="fa-solid fa-check-circle"></i>
                <h3>Verified stock</h3>
                <p>We only list parts and vehicles we can stand behind.</p>
              </div>
              <div className="trust-card">
                <i className="fa-solid fa-truck-fast"></i>
                <h3>Fast handling</h3>
                <p>Orders are processed and confirmed quickly for Ghana delivery.</p>
              </div>
              <div className="trust-card">
                <i className="fa-solid fa-headset"></i>
                <h3>Direct support</h3>
                <p>Support is handled by email and phone so you stay informed.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-inner">
            <div className="contact-copy">
              <p className="section-eyebrow">Contact</p>
              <h2 className="section-title">Ask about a part or vehicle</h2>
              <p>Send your inquiry straight to Samtuberg and we will confirm stock or pricing quickly.</p>
              <div className="contact-info-list">
                <div><i className="fa-solid fa-envelope"></i> <span>samtuberg34@gmail.com</span></div>
                <div><i className="fa-solid fa-phone"></i> <span>+233 24 123 4567</span></div>
                <div><i className="fa-solid fa-location-dot"></i> <span>Accra, Ghana</span></div>
              </div>
            </div>

            <form id="enquiry-form" className="enquiry-form">
              <div className="field-row">
                <label htmlFor="enq-name">Name</label>
                <input id="enq-name" type="text" placeholder="Your name" />
                <small className="error-text" id="enq-name-error"></small>
              </div>
              <div className="field-row">
                <label htmlFor="enq-email">Email</label>
                <input id="enq-email" type="email" placeholder="you@example.com" />
                <small className="error-text" id="enq-email-error"></small>
              </div>
              <div className="field-row">
                <label htmlFor="enq-phone">Phone</label>
                <input id="enq-phone" type="tel" placeholder="+233 ..." />
                <small className="error-text" id="enq-phone-error"></small>
              </div>
              <div className="field-row">
                <label htmlFor="enq-message">Message</label>
                <textarea id="enq-message" rows="5" placeholder="Tell us what part or car you need"></textarea>
                <small className="error-text" id="enq-message-error"></small>
              </div>
              <button type="submit" className="btn btn-primary btn-block">Send Enquiry</button>
            </form>
          </div>
        </section>
      </main>

      <aside className="cart-modal modal" id="cart-modal" aria-hidden="true">
        <div className="modal-panel cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <div className="modal-header">
            <div>
              <p className="modal-kicker">Your cart</p>
              <h2 id="cart-title">Shopping basket</h2>
            </div>
            <button className="modal-close" id="cart-close" type="button" aria-label="Close cart">&times;</button>
          </div>

          <div className="cart-empty" id="cart-empty">Your cart is empty.</div>
          <div className="cart-table-wrap" id="cart-table">
            <table className="cart-table">
              <thead>
                <tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th></tr>
              </thead>
              <tbody id="cart-items"></tbody>
            </table>
          </div>
          <div className="cart-mobile-list" id="cart-mobile-list"></div>

          <div className="cart-footer">
            <div className="cart-total-row">
              <span>Total</span>
              <strong id="cart-total">GH₵ 0</strong>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
