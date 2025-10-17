from fastapi import FastAPI, HTTPException, Response, Cookie, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
import bcrypt
import jwt
import httpx
import os
from datetime import datetime, timedelta
from dstack_sdk import DstackClient

app = FastAPI()

# Trust proxy headers to fix redirect port issues
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import Headers
import re

class ProxyHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to respect X-Forwarded-* headers and fix redirect ports"""
    async def dispatch(self, request, call_next):
        # Get forwarded host (without port)
        forwarded_host = request.headers.get("x-forwarded-host")
        forwarded_proto = request.headers.get("x-forwarded-proto")

        if forwarded_host:
            # Replace Host header with X-Forwarded-Host (strips port)
            headers = dict(request.headers)
            headers["host"] = forwarded_host
            request._headers = Headers(headers)
            request.scope["headers"] = [(k.encode(), v.encode()) for k, v in headers.items()]

        if forwarded_proto:
            request.scope["scheme"] = forwarded_proto

        response = await call_next(request)

        # Strip port from Location header in redirects (if present)
        if "location" in response.headers:
            location = response.headers["location"]
            # Remove :port from URLs like https://domain:8080/path -> https://domain/path
            # Pattern matches: (scheme)://(domain):port(/path)
            fixed_location = re.sub(r'(https?://[^/:]+):\d+(/.*)', r'\1\2', location)
            if fixed_location != location:
                response.headers["location"] = fixed_location
                print(f"🔧 Fixed redirect: {location} -> {fixed_location}")

        return response

app.add_middleware(ProxyHeadersMiddleware)

# Configuration from environment
USERNAME = os.getenv("VIBEVM_USERNAME", "admin")
VIBEVM_PASSWORD = os.getenv("VIBEVM_PASSWORD")

if not VIBEVM_PASSWORD:
    print("❌ ERROR: VIBEVM_PASSWORD must be set")
    raise ValueError("Missing password configuration: VIBEVM_PASSWORD is required")

# Hash password automatically and store as bytes
PASSWORD_HASH_BYTES = bcrypt.hashpw(VIBEVM_PASSWORD.encode(), bcrypt.gensalt())
print("✅ Password automatically hashed from VIBEVM_PASSWORD")

JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
JWT_PURPOSE = os.getenv("JWT_PURPOSE", "caliguland-session")
JWT_KEY_PATH = os.getenv("JWT_KEY_PATH", "caliguland/auth/signing")

# Cache for JWT signing key
_jwt_secret = None

def get_jwt_secret() -> str:
    """Derive JWT signing key from Dstack TEE"""
    global _jwt_secret
    if _jwt_secret:
        return _jwt_secret

    try:
        # Use Dstack to derive a deterministic key
        dstack = DstackClient()
        response = dstack.get_key(path=JWT_KEY_PATH)
        # Extract the actual key string from the response object
        _jwt_secret = response.key if hasattr(response, 'key') else response['key']
        print(f"✅ JWT key derived from Dstack TEE at path: {JWT_KEY_PATH}")
        return _jwt_secret
    except Exception as e:
        print(f"❌ Error deriving JWT key: {e}")
        raise HTTPException(status_code=500, detail="Failed to derive JWT key")

@app.get("/login", response_class=HTMLResponse)
async def login_page():
    """Serve login page"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>VibeVM Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background: linear-gradient(135deg, #97B748 0%, #647D1C 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .login-container {
                background: #FCFDFA;
                padding: 2.5rem;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(54, 65, 29, 0.3);
                width: 340px;
                max-width: 90%;
            }
            .logo {
                text-align: center;
                margin-bottom: 2rem;
            }
            .logo h1 {
                margin: 0;
                color: #36411D;
                font-size: 2rem;
                font-weight: 600;
            }
            .logo p {
                margin: 0.5rem 0 0 0;
                color: #647D1C;
                font-size: 0.875rem;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            label {
                display: block;
                margin-bottom: 0.5rem;
                color: #36411D;
                font-size: 0.875rem;
                font-weight: 500;
            }
            input {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #D1EB9C;
                border-radius: 6px;
                box-sizing: border-box;
                font-size: 1rem;
                transition: border-color 0.2s;
                background: #F7FBF1;
            }
            input:focus {
                outline: none;
                border-color: #BAE730;
                background: #FCFDFA;
            }
            button {
                width: 100%;
                padding: 0.875rem;
                background: linear-gradient(135deg, #C4F144 0%, #97B748 100%);
                color: #36411D;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: 600;
                transition: transform 0.1s, box-shadow 0.2s;
            }
            button:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(196, 241, 68, 0.5);
                background: linear-gradient(135deg, #BAE730 0%, #97B748 100%);
            }
            button:active {
                transform: translateY(0);
            }
            .error {
                color: #e74c3c;
                font-size: 0.875rem;
                margin-top: 1rem;
                text-align: center;
            }
            .footer {
                margin-top: 2rem;
                text-align: center;
                color: #647D1C;
                font-size: 0.75rem;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">
                <h1>🚀 VibeVM</h1>
                <p>Good Vibes, Zero Trust Required</p>
            </div>
            <form method="post" action="/login">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" placeholder="Enter your username" required autofocus>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" placeholder="Enter your password" required>
                </div>
                <button type="submit">Sign In</button>
            </form>
            <div class="footer">
                Powered by <a href="https://phala.com" target="_blank">Phala Cloud</a> x <a href="https://sandbox.agent-infra.com" target="_blank">AIO Sandbox</a> x <a href="https://github.com/Dstack-TEE/dstack" target="_blank">dstack</a>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)

@app.post("/login")
async def login(
    username: str = Form(...),
    password: str = Form(...),
    response: Response = None
):
    """Validate credentials and issue JWT"""
    from fastapi import Request

    # Validate username
    if username != USERNAME:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Validate password against bcrypt hash
    try:
        if not bcrypt.checkpw(password.encode(), PASSWORD_HASH_BYTES):
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        print(f"❌ Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Generate JWT token
    expiry = datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    token = jwt.encode(
        {
            "sub": username,
            "exp": expiry,
            "iat": datetime.utcnow(),
            "purpose": JWT_PURPOSE
        },
        get_jwt_secret(),
        algorithm="HS256"
    )

    print(f"✅ Login successful: {username}")

    # Set HttpOnly cookie and redirect (use relative path to avoid port issues)
    response = RedirectResponse(url="/code-server", status_code=302)
    response.set_cookie(
        key="vibevm_session",
        value=token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=JWT_EXPIRY_HOURS * 3600
    )
    return response

@app.get("/auth/validate")
async def validate(vibevm_session: str = Cookie(None)):
    """Validate JWT token (called by nginx auth_request)"""

    if not vibevm_session:
        raise HTTPException(status_code=401, detail="No session cookie")

    try:
        payload = jwt.decode(
            vibevm_session,
            get_jwt_secret(),
            algorithms=["HS256"]
        )

        # Validate purpose
        if payload.get("purpose") != JWT_PURPOSE:
            raise HTTPException(status_code=401, detail="Invalid token purpose")

        return {"status": "valid", "user": payload["sub"]}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "caliguland-auth"}

@app.get("/logout")
async def logout():
    """Clear session cookie"""
    response = RedirectResponse(url="/login", status_code=302)
    response.delete_cookie(key="vibevm_session")
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
