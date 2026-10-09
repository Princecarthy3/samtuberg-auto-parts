import React from 'react';

export const AboutSection = () => {
  return (
    <section className="about" id="about">
      <div className="about-inner">
        <p className="section-eyebrow">About Samtuberg</p>
        <h2 className="section-title">Parts first. Cars second. Trust always.</h2>
        <p className="about-text">
          Samtuberg Auto Parts &amp; Cars Company is built around one job: getting
          you the exact body part your vehicle needs, at a fair price in Ghana
          Cedis. Our shelves are stocked mainly with bumpers, headlights,
          taillights, and full body shells — front fenders, doors, bonnets and
          trunk lids — pulled and graded for the makes and models most common on
          Ghanaian roads. Alongside the parts, we also keep a small, hand-picked
          selection of used cars for customers ready to buy a full vehicle rather
          than repair one.
        </p>
        <div className="about-grid">
          <div className="about-card">
            <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
            <h3>Parts, mostly</h3>
            <p>The bulk of our stock is body parts, not full cars — that's where our expertise is.</p>
          </div>
          <div className="about-card">
            <i className="fa-solid fa-tags" aria-hidden="true"></i>
            <h3>Priced in Cedis</h3>
            <p>Every listing shows the exact model year it fits and its price in GH₵, upfront.</p>
          </div>
          <div className="about-card">
            <i className="fa-solid fa-envelope-circle-check" aria-hidden="true"></i>
            <h3>Order by email</h3>
            <p>Build your cart, send it straight to our inbox, and we'll confirm availability.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
