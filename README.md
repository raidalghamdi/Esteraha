# استراحة — Esteraha

**Bilingual (Arabic/English) shared expense tracker** for a group of friends co-running a Saudi gathering place (استراحة).

## What is Esteraha?

Esteraha helps 9 co-owners track shared expenses transparently — rent, setup costs, monthly operating, and worker salary. Every expense requires a receipt. The dashboard shows who has paid in, who owes the group, and how much each member needs to contribute monthly to cover the next rent payment.

The app is fully bilingual: Arabic (RTL, default) and English (LTR). Switch with the toggle in the sidebar.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 7 |
| UI | Tailwind CSS v3 + shadcn/ui |
| Data | Supabase (Postgres + Storage) |
| Routing | Wouter (hash-based SPA) |
| Forms | React Hook Form + Zod |
| i18n | Custom context (Arabic default, RTL) |
| Deploy | Vercel (static SPA) |

---

## Running Locally

```bash
# 1. Clone and install
git clone https://github.com/raid-a-alghamdi/Esteraha.git
cd Esteraha
npm install

# 2. Copy env file and fill in your values
cp .env.example .env.local
# Edit .env.local and add your VITE_SUPABASE_ANON_KEY

# 3. Start dev server
npm run dev
# Opens at http://localhost:5173
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (safe in browser, RLS enforced) |

---

## Building for Production

```bash
npm run build
# Output: dist/
```

---

## Deployed At

- **Live site**: https://esteraha.vercel.app
- **GitHub**: https://github.com/raidalghamdi/Esteraha
