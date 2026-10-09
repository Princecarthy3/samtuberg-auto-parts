import React, { useState } from 'react';
import { Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ORDER_EMAIL, sendToShop } from '../services/email';

export const ContactSection = () => {
  const { triggerToast } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !message.trim()) return;

    setIsSubmitting(true);

    const subject = `Enquiry — Samtuberg Auto Parts & Cars (${name.trim()})`;
    const bodyLines = [
      `New enquiry from Samtuberg's website`,
      ``,
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      `Phone: ${phone.trim()}`,
      ``,
      `Message:`,
      message.trim()
    ];

    const result = await sendToShop({
      subject,
      body: bodyLines.join('\n'),
      replyTo: email.trim(),
      fields: { name: name.trim(), phone: phone.trim() }
    });
    setIsSubmitting(false);

    if (!result.delivered) {
      triggerToast(`Could not email ${ORDER_EMAIL}: ${result.reason}`, 'error');
      return;
    }

    setSubmitted(true);
    triggerToast(`Enquiry sent to ${ORDER_EMAIL}!`, 'success');
    setName('');
    setEmail('');
    setPhone('');
    setMessage('');
  };

  return (
    <section className="contact-section" id="contact">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        
        {/* Contact Info */}
        <div className="space-y-6">
          <div>
            <p className="section-eyebrow">Get In Touch</p>
            <h2 className="section-title text-white">Can't find the part you need?</h2>
            <p className="text-slate-300 text-sm leading-relaxed max-w-md">
              Tell us the make, model and year, and what part you're after. We
              reply from the same inbox we take orders on.
            </p>
          </div>

          <ul className="space-y-4 text-slate-200 text-sm">
            <li className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-semibold">samtuberg34@gmail.com</span>
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Akoko Spurs, opposite Kovak Hill Educational Centre on Abrepo Road, Kumasi, Ghana</span>
            </li>
            <li className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Mon &ndash; Fri, 6:00am &ndash; 5:00pm</span>
            </li>
          </ul>

          <div className="contact-map-wrap">
            <div className="contact-map-heading">
              <h3>Find us in Abrepo</h3>
              <a href="https://www.google.com/maps/search/?api=1&amp;query=Kovak+Hill+Educational+Centre%2C+Abrepo+Road%2C+Kumasi%2C+Ghana" target="_blank" rel="noopener noreferrer">Directions to landmark</a>
            </div>
            <p className="contact-map-note">Find Kovak Hill Educational Centre on Abrepo Road; Akoko Spurs is directly opposite, near Assemblies of God Church.</p>
            <iframe
              className="contact-map-frame"
              src="https://maps.google.com/maps?q=6.7344062%2C-1.6520456&amp;z=17&amp;output=embed"
              title="Map centered on Kovak Hill Educational Centre on Abrepo Road, opposite Akoko Spurs"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>

        {/* Quick Enquiry Form */}
        <form onSubmit={handleSubmit} className="contact-form space-y-4">
          <h3 className="text-base font-bold text-white uppercase tracking-wide">Quick Enquiry</h3>

          {submitted ? (
            <div className="p-6 bg-emerald-950/80 border border-emerald-600 rounded-xl text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-white font-bold text-sm">Thanks! Your enquiry has been sent.</p>
              <p className="text-xs text-slate-300">Sent straight to samtuberg34@gmail.com — we'll get back to you soon.</p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-xs text-amber-400 font-bold underline"
              >
                Send another enquiry
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kwame Mensah"
                  className="w-full p-3 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full p-3 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0241234567"
                  className="w-full p-3 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">What are you looking for?</label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Front bumper for Toyota Corolla 2016"
                  className="w-full p-3 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-orange-700 hover:bg-orange-800 text-white font-bold text-sm py-3.5 rounded-lg flex items-center justify-center gap-2 uppercase tracking-wide shadow-lg"
              >
                <Send className="w-4 h-4" /> {isSubmitting ? 'Sending...' : 'Send Enquiry by Email'}
              </button>

              <p className="text-[11px] text-slate-400 text-center">
                Sent straight to samtuberg34@gmail.com — no email app required.
              </p>
            </>
          )}

        </form>

      </div>
    </section>
  );
};
