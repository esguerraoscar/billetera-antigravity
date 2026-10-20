# Transactions Service (`transactions-service`)

Microservicio de registro y categorización de gastos para la plataforma **Billetera**.

## Responsabilidades
- **Registrar gastos** (`POST /transactions`) con monto, categoría y fecha.
- **Consultar gastos** (`GET /transactions`) del usuario autenticado, con filtros opcionales.

## Autenticación
Este servicio **no valida JWT por sí mismo**. Cada petición a `/transactions` delega la verificación en `GET /auth/verify` de `auth-service` mediante `src/auth/authClient.js`, que es el único punto de autenticación. El `userId` se toma de la sesión verificada, nunca del body. Cada usuario solo ve sus propias transacciones.

## Endpoints

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/health` | Estado del servicio. |
| `POST` | `/transactions` | Crea una transacción: `amount` (número > 0), `category` (texto), `date` (`YYYY-MM-DD`), `description` (opcional). |
| `GET` | `/transactions` | Lista las transacciones del usuario (más recientes primero). Filtros: `?category=`, `?from=YYYY-MM-DD`, `?to=YYYY-MM-DD`. |

Ambos endpoints de `/transactions` requieren `Authorization: Bearer <token>`.

## Configuración

| Variable | Default | Descripción |
| :--- | :--- | :--- |
| `PORT` | `4002` | Puerto del servicio. |
| `AUTH_SERVICE_URL` | `http://localhost:4001` | URL base de `auth-service`. |
| `AUTH_TIMEOUT_MS` | `3000` | Timeout de la verificación de sesión. |

## Estructura

```text
src/
├── index.js                      # Entrypoint
├── config.js
├── auth/authClient.js            # Verificación de sesión vía auth-service
├── http/server.js                # Rutas HTTP
├── services/transactionService.js# Validación y lógica de negocio
├── store/transactionRepository.js# Almacenamiento en memoria
└── utils/logger.js               # Logger con redacción de datos sensibles
```

## Notas
- El almacenamiento es **en memoria** (igual que `auth-service`): los datos se pierden al reiniciar.
- Las categorías son texto libre normalizado a minúsculas.

## Ejecución y Pruebas

```bash
npm test
npm start
```
