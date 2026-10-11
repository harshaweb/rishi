# MongoDB Atlas backend

Set `MONGODB_URL` in the ignored `.env` file locally and in Vercel's Production environment settings. Use your Atlas database user, URL-encoded password, and a database name:

```
MONGODB_URL=mongodb+srv://USER:PASSWORD@cluster0.xphpuau.mongodb.net/harshaweb?retryWrites=true&w=majority&appName=Cluster0
```

The supplied `<db_username>` and `<db_password>` placeholders cannot authenticate. Create a database user with read/write access to `harshaweb` in Atlas Database Access, and allow your backend's network in Atlas Network Access. Use an Atlas replica set (required for Prisma transactions).

Run these commands after configuring the real URL:

```
npm run db:generate
npm run db:migrate
npm run db:seed
npm run admin:create
npm run dev
```

`db:migrate` uses Prisma `db push` for MongoDB and existing migrations for PostgreSQL. It does not automatically copy existing PostgreSQL records. Seeding adds initial content without overwriting existing content. Admin accounts must be created in the selected database.

The backend selects MongoDB when `MONGODB_URL` is set or `DATABASE_URL` uses a MongoDB scheme. Content uses Prisma, admin sessions use a MongoDB session store, and submission rate counters use atomic MongoDB updates. Existing string IDs are preserved, including seeded content IDs.

Build with the same database provider used at runtime. On Vercel, configure the MongoDB URL before building/redeploying; do not reuse a PostgreSQL-generated Prisma client for MongoDB. Production also requires `SESSION_SECRET` and an HTTPS `SITE_URL`. Check `/api/health` after deploying. Never commit connection credentials or expose them in frontend `VITE_` variables.
