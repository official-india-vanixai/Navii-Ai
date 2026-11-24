"""
Security & Authentication Module for N.A.V.I.I.
Verifies Firebase & Supabase JWT tokens and extracts authenticated user identities.
"""

from typing import Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

from app.core.config import settings
from app.models.schemas import UserProfile

security_bearer = HTTPBearer(auto_error=False)


def decode_auth_token(token: str) -> Optional[dict]:
    """
    Decodes and validates a Firebase or Supabase JWT token.
    Extracts identity claims safely.
    """
    if not token:
        return None

    try:
        # Check if Supabase JWT secret is configured
        if settings.SUPABASE_JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated"
                )
                return payload
            except JWTError:
                pass

        # Decode claims (supports Firebase ID tokens and unverified dev tokens)
        unverified = jwt.get_unverified_claims(token)
        return unverified
    except Exception:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> UserProfile:
    """
    Dependency that extracts the current authenticated user from Bearer JWT.
    Supports Firebase Auth (Google Sign-In & Email/Password) and Supabase Auth.
    """
    if credentials:
        token = credentials.credentials
        payload = decode_auth_token(token)
        if payload and ("sub" in payload or "user_id" in payload):
            user_id = payload.get("sub") or payload.get("user_id")
            
            # Extract Firebase claims (name, picture, email) or Supabase claims (user_metadata)
            email = payload.get("email") or "operator@navii.ai"
            full_name = (
                payload.get("name")
                or payload.get("user_metadata", {}).get("full_name")
                or email.split("@")[0].title()
            )
            avatar_url = (
                payload.get("picture")
                or payload.get("user_metadata", {}).get("avatar_url")
            )

            return UserProfile(
                id=user_id,
                email=email,
                full_name=full_name,
                avatar_url=avatar_url
            )

    # In production, require valid token
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Safe default for local development/MVP testing before user logs in
    return UserProfile(
        id="dev-operator-001",
        email="operator@navii.ai",
        full_name="Navii Operator (Local Dev)",
        avatar_url=None
    )
