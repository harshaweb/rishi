# MongoDB setup

The current source layout and commands are documented in ../../README.md.

Store `MONGODB_URI` privately in the ignored repository-root `.env`. The backend accepts `MONGODB_URI` first, followed by the older `MONGODB_URL` alias or `DATABASE_URL`. A missing MongoDB database name defaults to `omshivraj`. Password placeholders are rejected.

Use Atlas or a MongoDB replica set. Native MongoDB collections store rental accounts, listings, availability, bookings, payments, wishlists, messages and admin records. MongoDB also stores sessions and rate counters. Retained content-management features use the MongoDB Prisma schema. Booking inventory is protected by transactions, a property write lock and a unique property/night index.

Run `npm run db:check` to verify ping, transaction support, read/write and rollback without retaining test records. Atlas access requires a running cluster, valid database-user permissions and appropriate Network Access rules. The current Atlas connection from this computer fails during the TLS handshake, before authentication; its access configuration must be checked before claiming a successful live connection.

`npm run dev:local` provides persistent local MongoDB on port 27018 while preserving the private Atlas URL. Existing local PostgreSQL records were copied without deleting the source. `npm test` uses a separate disposable replica set and never touches Atlas.

Initialize a chosen live database with `npm run db:generate`, `npm run db:migrate` and `npm run rental:catalog`; create a private admin with `npm run rental:admin`. These commands do not create real property inventory. Add verified hosts and real listings through the admin/host UI. Configure production email, object storage and payment credentials for their corresponding features.

Never commit `.env`, expose credentials through `VITE_` variables, or disable TLS verification. Rotate credentials disclosed in chat before production use.
