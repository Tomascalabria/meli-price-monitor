# MELI Price Monitor

Dashboard para monitorear precios de múltiples sellers en MercadoLibre. Ideal para detectar cuando un seller cambia sus precios fuera del rango acordado.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend + API | Next.js 14 (App Router) |
| Base de datos | Supabase (PostgreSQL) |
| Hosting | Vercel (free tier) |
| Cron jobs | Vercel Cron (cada hora) |
| Datos | MercadoLibre Public API |

## Setup rápido

### 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com)
2. En el SQL editor, ejecutar el archivo `supabase/migrations/001_schema.sql`
3. Copiar las credenciales desde **Project Settings → API**

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Completar con:
- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (solo server-side)
- `CRON_SECRET` — string aleatorio para proteger el endpoint del cron

### 3. Instalar y correr

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

### 4. Deploy en Vercel

```bash
npx vercel --prod
```

Agregar las variables de entorno en el dashboard de Vercel. El cron job en `vercel.json` corre automáticamente cada hora.

---

## Cómo usar

### Importar sellers

Ir a **Importar** y subir un CSV o JSON con los items a trackear.

**CSV:**
```csv
group_name,meli_item_id,notes
"Auriculares Sony",MLA123456789,Seller principal
"Auriculares Sony",MLA987654321,Seller secundario
```

**JSON:**
```json
[
  {
    "group_name": "Auriculares Sony",
    "reference_price": 15000,
    "alert_threshold_pct": 5,
    "items": [
      { "meli_item_id": "MLA123456789", "notes": "Seller A" },
      { "meli_item_id": "MLA987654321", "notes": "Seller B" }
    ]
  }
]
```

### Actualizar precios

- **Automático**: el cron corre cada hora en producción
- **Manual**: botón "Actualizar precios" en el dashboard

### Alertas

Configurar en cada grupo:
- **Precio de referencia**: el precio "correcto" o acordado
- **Umbral de alerta (%)**: si un seller se desvía más de X%, aparece una alerta roja

---

## Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/groups` | Listar todos los grupos |
| POST | `/api/groups` | Crear grupo |
| GET | `/api/groups/:id` | Detalle del grupo con precios |
| PUT | `/api/groups/:id` | Actualizar configuración |
| DELETE | `/api/groups/:id` | Eliminar grupo |
| POST | `/api/groups/:id/items` | Agregar item al grupo |
| DELETE | `/api/groups/:id/items?item_id=` | Desactivar item |
| GET | `/api/groups/:id/history` | Historial de precios (7 días) |
| POST | `/api/scrape` | Trigger manual de scrape |
| POST | `/api/import` | Importar CSV/JSON |
| GET | `/api/cron/scrape` | Endpoint del cron (protegido) |
