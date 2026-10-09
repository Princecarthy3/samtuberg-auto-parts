# Production database blueprint

This project should use a real MySQL database for production ecommerce work.

Why this matters:
- customer orders must be saved reliably
- payment references must be linked to the correct order
- stock and product availability must be tracked
- admins need a secure place to review orders, sales, and status updates

The schema in schema.sql includes the main tables needed for a hosted store:
- customers
- products
- orders
- order_items
- payments
- admin_users
- order_events

Typical flow:
1. Customer places order in the storefront.
2. Order is inserted into the orders and order_items tables.
3. Payment is sent to Paystack.
4. Paystack confirmation updates the payments and orders tables.
5. Stock levels are reduced and admins can review the order in the dashboard.

For a live hosted site, your website code should connect to the MySQL database on your hosting server, not only local browser storage.

The API rate-limits failed customer and admin logins by account and client address. If it runs behind a reverse proxy, set `TRUST_PROXY=true` only when that proxy overwrites incoming `X-Forwarded-For` or `X-Real-IP` headers with the verified client address. Otherwise, clients could spoof their address and bypass the login limit.

Production security requirements:
- Set `NODE_ENV=production` and configure the exact storefront origin in `FRONTEND_ORIGIN` or `FRONTEND_ORIGINS`.
- Set a unique `CATALOG_ADMIN_USERNAME` and a 12+ character `CATALOG_ADMIN_PASSWORD` containing uppercase and lowercase letters, a number, and a symbol. Keep secrets outside source control and rotate any credential that has been shared.
- MySQL TLS is enabled automatically in production and validates the server certificate. Set `DB_SSL_CA` when the provider requires a custom CA certificate.
- Use a dedicated MySQL application account with only the required privileges on `samtuberg_store`; do not connect as `root` or expose the database port publicly. Allow inbound database connections only from the API host.
- Keep database and customer/order data files out of public web roots, restrict backups, and encrypt backups at rest.

These controls reduce common account and data risks, but do not replace HTTPS, host patching, secret rotation, backups, or a reviewed deployment configuration.

Use this SQL file as the base for your live database and adapt it to your hosting provider or MySQL version.
