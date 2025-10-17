import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { DstackSDK } from '@phala/dstack-sdk';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configuration
const USERNAME = process.env.VIBEVM_USERNAME || 'admin';
const VIBEVM_PASSWORD = process.env.VIBEVM_PASSWORD;
const JWT_EXPIRY_HOURS = parseInt(process.env.JWT_EXPIRY_HOURS || '24');
const JWT_PURPOSE = process.env.JWT_PURPOSE || 'caliguland-session';
const JWT_KEY_PATH = process.env.JWT_KEY_PATH || 'caliguland/auth/signing';
const PORT = 3000;

if (!VIBEVM_PASSWORD) {
  console.error('❌ ERROR: VIBEVM_PASSWORD must be set');
  process.exit(1);
}

// Hash password on startup
let PASSWORD_HASH: string;
(async () => {
  PASSWORD_HASH = await bcrypt.hash(VIBEVM_PASSWORD, 10);
  console.log('✅ Password automatically hashed from VIBEVM_PASSWORD');
})();

// JWT Secret Cache
let jwtSecret: string | null = null;

async function getJwtSecret(): Promise<string> {
  if (jwtSecret) return jwtSecret;

  try {
    const dstack = new DstackSDK();
    const response = await dstack.deriveKey(JWT_KEY_PATH);
    jwtSecret = response.key;
    console.log(`✅ JWT key derived from Dstack TEE at path: ${JWT_KEY_PATH}`);
    return jwtSecret;
  } catch (error) {
    console.error('❌ Error deriving JWT key:', error);
    throw new Error('Failed to derive JWT key');
  }
}

// Proxy headers middleware (fix redirect port issues)
app.use((req, res, next) => {
  const forwardedHost = req.headers['x-forwarded-host'];
  const forwardedProto = req.headers['x-forwarded-proto'];

  if (forwardedHost) {
    req.headers.host = forwardedHost as string;
  }

  // Intercept response to fix Location header
  const originalRedirect = res.redirect;
  res.redirect = function (statusOrUrl: any, url?: any) {
    const actualUrl = url || statusOrUrl;
    const actualStatus = url ? statusOrUrl : 302;
    
    // Strip port from redirect URLs
    const fixedUrl = typeof actualUrl === 'string' 
      ? actualUrl.replace(/(https?:\/\/[^/:]+):\d+(\/.*)/g, '$1$2')
      : actualUrl;
    
    if (fixedUrl !== actualUrl) {
      console.log(`🔧 Fixed redirect: ${actualUrl} -> ${fixedUrl}`);
    }
    
    return originalRedirect.call(this, actualStatus, fixedUrl);
  };

  next();
});

// Login page (GET)
app.get('/login', (req: Request, res: Response) => {
  const html = `
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
  `;
  res.send(html);
});

// Login handler (POST)
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate username
    if (username !== USERNAME) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    // Validate password
    const isValid = await bcrypt.compare(password, PASSWORD_HASH);
    if (!isValid) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    // Generate JWT token
    const secret = await getJwtSecret();
    const expiry = Math.floor(Date.now() / 1000) + (JWT_EXPIRY_HOURS * 3600);
    
    const token = jwt.sign(
      {
        sub: username,
        exp: expiry,
        iat: Math.floor(Date.now() / 1000),
        purpose: JWT_PURPOSE
      },
      secret,
      { algorithm: 'HS256' }
    );

    console.log(`✅ Login successful: ${username}`);

    // Set cookie and redirect
    res.cookie('vibevm_session', token, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax',
      maxAge: JWT_EXPIRY_HOURS * 3600 * 1000
    });

    res.redirect('/code-server');
  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(401).json({ detail: 'Invalid credentials' });
  }
});

// Validate JWT (called by nginx auth_request)
app.get('/auth/validate', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.vibevm_session;

    if (!token) {
      return res.status(401).json({ detail: 'No session cookie' });
    }

    const secret = await getJwtSecret();
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;

    // Validate purpose
    if (payload.purpose !== JWT_PURPOSE) {
      return res.status(401).json({ detail: 'Invalid token purpose' });
    }

    res.json({ status: 'valid', user: payload.sub });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ detail: 'Session expired' });
    }
    return res.status(401).json({ detail: `Invalid token: ${error}` });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'caliguland-auth' });
});

// Logout
app.get('/logout', (req: Request, res: Response) => {
  res.clearCookie('vibevm_session');
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`🚀 VibeVM Auth Service listening on port ${PORT}`);
});

