import React from 'react';
import { useApp } from '../context/AppContext';

export const HeroBanner = () => {
  return (
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
  );
};
