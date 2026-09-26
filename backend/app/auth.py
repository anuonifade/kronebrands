from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings
from .db import get_db

bearer = HTTPBearer(auto_error=False)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(email: str) -> str:
    s = get_settings()
    payload = {
        "sub": email,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=s.jwt_expiry_minutes),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


async def require_admin(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue")
    try:
        payload = jwt.decode(creds.credentials, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired. Sign in again")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")
    admin = await get_db().admins.find_one({"email": payload.get("sub")})
    if not admin or payload.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not an admin account")
    return admin
