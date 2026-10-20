# Auth Service (`auth-service`)

Microservicio de autenticación y gestión de sesión para la plataforma **Billetera**.

## Responsabilidades
De acuerdo con la arquitectura del monorepo:
- **Registro de usuarios** (`/auth/register`) con almacenamiento seguro de contraseñas.
- **Inicio de sesión** (`/auth/login`) y emisión de tokens **JWT** (`HS256`).
- **Verificación de sesión y control de acceso** (`/auth/verify` y `/auth/me`) centralizados en un único módulo validador.

## Reglas de Seguridad (`AGENTS.md`)
1. **Prohibido loguear credenciales o tokens en texto plano**: Todo registro pasa por `src/utils/logger.js`, que redacta automáticamente campos sensibles (`password`, `token`, `authorization`, etc.) y patrones de tokens JWT.
2. **Módulo central único de validación de sesión**: Toda validación de sesión y verificación de JWT ocurre exclusivamente en `src/session/sessionValidator.js`.
3. **Hashing de contraseñas**: Implementado en `src/security/passwordHasher.js` utilizando `scrypt` (`N=16384, r=8, p=1`, clave de 64 bytes), salt criptográfico aleatorio de 16 bytes por usuario y comparación en tiempo constante (`crypto.timingSafeEqual`).

## Endpoints

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Registra un nuevo usuario (`email`, `password`, `name`). |
| `POST` | `/auth/login` | Autentica credenciales y emite un token JWT de sesión. |
| `POST` / `GET` | `/auth/verify` | Verifica la validez de un token JWT (`Authorization: Bearer <token>` o body). |
| `GET` | `/auth/me` | Ruta protegida que retorna el perfil del usuario autenticado. |
| `POST` | `/auth/logout` | Revoca el token de la sesión actual en el módulo central de sesiones. |

## Ejecución y Pruebas

```bash
# Ejecutar pruebas automatizadas
npm test

# Iniciar el servidor
npm start
```
