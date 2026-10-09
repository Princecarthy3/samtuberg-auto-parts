# React + Vite

## MySQL setup

Start MySQL from the XAMPP Control Panel, then set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `.env` to match your local MySQL account. For the standard XAMPP defaults, the host is `127.0.0.1`, the port is `3306`, and the user is `root`; use the password configured for that account. Run `npm run db:init` to create the database and tables. The database account must have permission to create databases, or the database must already exist and the account must have permission to create tables.

The MySQL schema covers products, customers, orders, order items, payments, order events, admin users, and admin settings. The current server actively uses MySQL for order/payment records and admin settings when database configuration is present. Catalog overrides, inventory reservations, customer login records, and the JSON order backup still use the application's local files; creating these tables does not automatically move those features into MySQL.

## Paystack on mobile and production

The storefront starts Ghana mobile-money payments through Paystack's server-side Charge API, passing the selected provider and normalized phone number; card and bank-transfer checkout use Paystack Inline. Pending MoMo charges are checked at Paystack's recommended interval, and OTP is requested only if Paystack returns `send_otp`. The site verifies the transaction reference, amount, and currency before showing a paid receipt. Customers approve mobile-money requests and enter their MoMo PIN on their phone, never on the storefront.

Only server-verified successful Paystack transactions are recorded as paid. The admin Payment Transactions view shows the buyer's contact and delivery details together with the verified reference, channel/provider, gateway response, amount, fees, and payment time. Card details are limited to the brand and last four digits.

Sales analytics and revenue totals include only orders with a paid status, a Paystack payment method, and a real payment reference. Pending orders, failed or abandoned checkouts, unpaid placeholder references, and cash-on-delivery orders do not add to revenue until verified Paystack payment is recorded.

The Paystack button stays unavailable until the verification server health check succeeds, preventing a live charge that the site cannot confirm. For local development, run the storefront and `node server.mjs` on the same computer. Static XAMPP storefronts load the public Paystack key from `GET /api/paystack/config`; set `VITE_PAYSTACK_PUBLIC_KEY` or `PAYSTACK_PUBLIC_KEY` in the server environment for that route. For a deployed HTTPS storefront, deploy `server.mjs` behind a public HTTPS URL, set `VITE_PAYSTACK_API_BASE` to that URL, and set `FRONTEND_ORIGIN` to the exact storefront origin. Use comma-separated `FRONTEND_ORIGINS` if multiple exact origins are needed. The server's secret key must remain in the server environment; never put it in a `VITE_` variable.

Build the frontend again after setting `VITE_PAYSTACK_PUBLIC_KEY` and `VITE_PAYSTACK_API_BASE` so the deployed app uses the live key and reachable verification server.

## Shared product catalog and admin CRUD

The storefront merges the baseline catalog with server-saved edits, additions, and deletions from `GET /api/products`, refreshing while open so changes appear on other devices. Admin changes use the authenticated `PUT` and `DELETE` routes and persist to `data/catalog-overrides.json` by default. Run `node server.mjs` on a host reachable by both devices. Set `VITE_PAYSTACK_API_BASE` to that server's URL when it is not reachable at the storefront hostname on port `8787`. HTTP storefronts on the same localhost or private LAN hostname are allowed automatically, including XAMPP on port 80; configure `FRONTEND_ORIGINS` with exact origins when the storefront and API use different hosts. Set `CATALOG_ADMIN_USERNAME` and a unique `CATALOG_ADMIN_PASSWORD` on the server before production; the local-only development login fallback must not be used on a public deployment. Keep the catalog file on persistent storage and run a single server instance. For scaled or ephemeral hosting, configure a shared database/persistent catalog store instead. Locally stored custom products are uploaded on admin login when they are not already present in the shared catalog.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Customer accounts and order notifications

Customer registration and sign-in require the API server. Accounts are stored in `data/customers-store.json`; passwords are bcrypt hashes, and the file is excluded from source control. Customers sign in with the username or email and password they registered. Set `CATALOG_ADMIN_USERNAME` and `CATALOG_ADMIN_PASSWORD` on the server for admin access; there are no built-in admin or viewer credentials.

Order email confirmations to the customer and order notices to the store require `RESEND_API_KEY` and a sender address authorized by Resend in `ORDER_NOTIFICATION_FROM`. The admin destination defaults to `samtuberg34@gmail.com` and can be changed with `ADMIN_NOTIFICATION_EMAIL`.

SMS confirmations to the customer and admin require `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`. The admin destination defaults to `+233208111135` and can be changed with `ADMIN_NOTIFICATION_PHONE`. Customer numbers entered in Ghana local format are converted to E.164 format before sending. The order API reports notification delivery status; unconfigured or failed providers are not reported as sent.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
