import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from fastapi import HTTPException, Request
from functools import wraps
from typing import Callable
import inspect

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e


def _get_token_from_request(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        return None
    parts = auth.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def require_role(request: Request, role: str) -> Dict[str, Any]:
    token = _get_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authorization token missing")
    payload = decode_token(token)
    if payload.get("role") != role:
        raise HTTPException(status_code=403, detail="Forbidden: insufficient role")
    return payload


def rbac_required(role: str, audit_action: str | None = None, audit_logger: Callable[[Dict[str, Any], str, Dict[str, Any]], None] | None = None):
    """Decorator for FastAPI *function-style* route handlers to enforce a role and optionally audit.

    Usage:
        @rbac_required('student', audit_action='update_progress', audit_logger=my_logger)
        def handler(request: Request, ...):
            ...

    Constraints:
      - The wrapped function MUST accept a `Request` instance either as a positional
        argument or a keyword argument named 'request'. If not found, 500 is raised.
      - On failure raises HTTPException 401/403 similar to require_role.
      - If audit_logger provided it is called with (payload, audit_action, context_dict)
        where context_dict attempts to extract simple serialisable parameters.
    """
    def decorator(func: Callable):
        sig = inspect.signature(func)

        @wraps(func)
        def wrapper(*args, **kwargs):
            # Locate the request object in args/kwargs
            bound = sig.bind_partial(*args, **kwargs)
            request: Request | None = None
            for name, val in bound.arguments.items():
                if isinstance(val, Request):
                    request = val
                    break
            if request is None:
                # Try kwargs explicit name
                candidate = kwargs.get('request')
                if isinstance(candidate, Request):
                    request = candidate
            if request is None:
                raise HTTPException(status_code=500, detail='RBAC decorator misconfiguration: Request not found')

            payload = require_role(request, role)

            result = func(*args, **kwargs)

            if audit_logger and audit_action:
                try:
                    # Build light context (exclude large bodies)
                    ctx = {}
                    for k, v in bound.arguments.items():
                        if k == 'request':
                            continue
                        # Only keep primitives / short strings
                        if isinstance(v, (str, int, float, bool)):
                            ctx[k] = v
                        elif hasattr(v, 'dict'):
                            # Pydantic model or similar
                            try:
                                ctx[k] = {kk: vv for kk, vv in v.dict().items() if isinstance(vv, (str, int, float, bool))}
                            except Exception:
                                pass
                    audit_logger(payload, audit_action, ctx)
                except Exception:
                    # Non-fatal; auditing must not break primary path
                    pass
            return result
        return wrapper
    return decorator
