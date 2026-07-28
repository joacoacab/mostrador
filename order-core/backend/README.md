# order-core/backend

Backend del Order Core: Django + DRF + PostgreSQL, multi-tenant por `tenant_id`.

Apps: `tenants`, `accounts`, `catalog`, `orders` (sin modelos todavía, ver `docs/tasks.md` tarea 4 en adelante).

## Desarrollo local

```bash
cp .env.example .env          # ajustar valores si hace falta
docker compose up -d          # levanta PostgreSQL

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python manage.py runserver
```
