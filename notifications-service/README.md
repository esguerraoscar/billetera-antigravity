# Notifications Service (`notifications-service`)

Microservicio de generación y consulta de alertas de sobregasto para la plataforma **Billetera**.

## Responsabilidades
- **Evaluar eventos de nuevas transacciones** (`POST /notifications/evaluate` o `POST /notifications`) contra el presupuesto correspondiente del usuario y su gasto acumulado, generando alertas en dos niveles:
  - `warning`: cuando el consumo alcanza o supera el umbral de advertencia (por defecto `>= 80%` del límite).
  - `exceeded`: cuando el consumo supera el `100%` del monto límite (`spentAmount > limitAmount`).
- **Consultar alertas generadas** (`GET /notifications`) del usuario autenticado, con filtros opcionales por categoría, periodo y nivel (`warning` | `exceeded`).

## Autenticación y Comunicación entre Servicios
- Este servicio **no valida JWT por sí mismo**. Cada petición delega la verificación en `GET /auth/verify` de `auth-service` mediante `src/auth/authClient.js`.
- Para evaluar una transacción, consulta por HTTP a `budgets-service` (`GET /budgets`) y `transactions-service` (`GET /transactions`) reenviando el encabezado `Authorization: Bearer <token>` del usuario autenticado.

## Endpoints

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/health` | Estado del servicio. |
| `POST` | `/notifications/evaluate` (o `/notifications`) | Recibe un evento de transacción (`amount`, `category`, `date`, y opcionalmente `id`/`transactionId` y `period`), evalúa el presupuesto correspondiente y genera una alerta si corresponde (`201` si genera alerta, `200` si no requiere alerta). |
| `GET` | `/notifications` | Lista las alertas generadas del usuario (más recientes primero). Filtros: `?category=`, `?period=`, `?level=warning\|exceeded`. |

Todos los endpoints de `/notifications` requieren `Authorization: Bearer <token>`.

## Configuración

| Variable | Default | Descripción |
| :--- | :--- | :--- |
| `PORT` | `4004` | Puerto del servicio. |
| `AUTH_SERVICE_URL` | `http://localhost:4001` | URL base de `auth-service`. |
| `TRANSACTIONS_SERVICE_URL` | `http://localhost:4002` | URL base de `transactions-service`. |
| `BUDGETS_SERVICE_URL` | `http://localhost:4003` | URL base de `budgets-service`. |
| `AUTH_TIMEOUT_MS` | `3000` | Timeout de la verificación de sesión. |
| `SERVICE_TIMEOUT_MS` | `3000` | Timeout para llamadas a otros microservicios. |
| `WARNING_THRESHOLD` | `0.8` | Proporción (0 a 1) a partir de la cual se emite alerta `warning`. |

## Estructura

```text
src/
├── index.js                           # Entrypoint
├── config.js
├── auth/authClient.js                 # Verificación de sesión vía auth-service
├── clients/budgetsClient.js           # Consulta de presupuestos a budgets-service
├── clients/transactionsClient.js      # Consulta de gastos acumulados a transactions-service
├── http/server.js                     # Rutas HTTP
├── services/notificationService.js    # Evaluación de presupuestos y lógica de negocio
├── store/notificationRepository.js    # Almacenamiento en memoria de alertas
└── utils/logger.js                    # Logger con redacción de datos sensibles
```

## Ejecución y Pruebas

```bash
npm test
npm start
```
