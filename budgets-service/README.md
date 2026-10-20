# Budgets Service (`budgets-service`)

Microservicio de definición y consulta de presupuestos por categoría para la plataforma **Billetera**.

## Responsabilidades
- **Definir presupuestos** (`POST /budgets`) con categoría, monto límite y periodo.
- **Consultar presupuestos** (`GET /budgets`) del usuario autenticado, con filtros opcionales por categoría y periodo.

## Autenticación
Este servicio **no valida JWT por sí mismo**. Cada petición a `/budgets` delega la verificación en `GET /auth/verify` de `auth-service` mediante `src/auth/authClient.js`, que es el único punto de autenticación. El `userId` se toma de la sesión verificada, nunca del body. Cada usuario solo ve sus propios presupuestos.

## Endpoints

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/health` | Estado del servicio. |
| `POST` | `/budgets` | Crea un presupuesto: `category` (texto), `limitAmount` (número > 0), `period` (texto, ej. `2026-10` o `mensual`). |
| `GET` | `/budgets` | Lista los presupuestos del usuario. Filtros: `?category=`, `?period=`. |

Ambos endpoints de `/budgets` requieren `Authorization: Bearer <token>`.

## Configuración

| Variable | Default | Descripción |
| :--- | :--- | :--- |
| `PORT` | `4003` | Puerto del servicio. |
| `AUTH_SERVICE_URL` | `http://localhost:4001` | URL base de `auth-service`. |
| `AUTH_TIMEOUT_MS` | `3000` | Timeout de la verificación de sesión. |

## Estructura

```text
src/
├── index.js                  # Entrypoint
├── config.js
├── auth/authClient.js        # Verificación de sesión vía auth-service
├── http/server.js            # Rutas HTTP
├── services/budgetService.js # Validación y lógica de negocio
├── store/budgetRepository.js # Almacenamiento en memoria
└── utils/logger.js           # Logger con redacción de datos sensibles
```

## Notas
- El almacenamiento es **en memoria** (igual que `auth-service` y `transactions-service`): los datos se pierden al reiniciar.
- Las categorías y periodos son texto normalizado a minúsculas.

## Ejecución y Pruebas

```bash
npm test
npm start
```
