# LifeLink Backend — Setup & Run

Follow these steps to run the backend locally.

1) Install dependencies

```bash
cd lifelink-backend
npm install
```

2) Create `.env` from `.env.example`

- Copy the example file and fill in `MONGODB_URI` and `JWT_SECRET`:

```bash
cd lifelink-backend
copy .env.example .env    # Windows (PowerShell/CMD)
cp .env.example .env      # macOS / Linux
```

- Example `MONGODB_URI` values:
  - Local mongod (default): `mongodb://localhost:27017/lifelink`
  - Atlas: `mongodb+srv://<user>:<pass>@cluster0.mongodb.net/lifelink?retryWrites=true&w=majority`

3) Start MongoDB (if using local)

- Windows (if installed as a service):
  - Start the service in Services or run `net start MongoDB` (if installed as a service).
- If you installed MongoDB locally and use the `mongod` binary:

```powershell
# open a new terminal and run (example path may vary)
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath "C:\data\db"
```

4) Start the backend

```bash
# development (with nodemon if installed)
npm run dev
# or
npm start
```

5) Verify health

Open: `http://localhost:5000/api/health` (should return JSON status if server and DB connect).

Notes
- If you use MongoDB Atlas, whitelist your IP or use a connection string that allows access.
- Keep `JWT_SECRET` secret in production; do not commit `.env` to source control.
- The backend serves the frontend static files from `lifelink-frontend` by default.
