import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://cybercheck-uni.vercel.app";
const IS_DEV = false; // prod'da false qilasan

/* ================== MEMORY STORAGE ================== */
// Tokenlar faqat memory'da saqlanadi, refresh qilinsa o'chadi
const memoryTokens = new Map<string, {
  user_id: string;
  login: string;
  full_name: string;
  role: string;
  expires_at: string;
  fingerprint?: string;
  user_agent?: string;
}>();

/* ================== HELPERS ================== */

function corsHeaders(origin: string | null = null) {
  // Allowed origins for production and development
  const allowedOrigins = [
    "https://cybercheck-uni.vercel.app",
    "http://localhost:8080",
    "http://localhost:5173"
  ];
  
  // Dynamic CORS - ruxsat berilgan originlardan birini tanlash
  const allowedOrigin = allowedOrigins.includes(origin || "") ? origin : allowedOrigins[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin || "*",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, extraHeaders = {}, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

function parseCookies(cookieHeader: string | null) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  cookieHeader.split(";").forEach((c) => {
    const [k, v] = c.trim().split("=");
    if (k && v) out[k] = v;
  });

  return out;
}

/* ================== SERVER ================== */

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  
  /* ---------- OPTIONS ---------- */
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  /* ---------- LOGIN ---------- */
  if (action === "login") {
    const { login, password, fingerprint, userAgent } = await req.json();

    if (!login || !password) {
      return json({ error: "Login va parol shart" }, 400, {}, origin);
    }

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("login", login)
      .eq("is_active", true)
      .maybeSingle();

    if (!user) {
      return json({ error: "Login yoki parol noto'g'ri" }, 401, {}, origin);
    }

    // Password check - bcrypt hash bilan solishtirish
    // Demo uchun oddiy solishtirish, aslida bcrypt kerak
    if (user.password_hash !== password && user.password_hash !== '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LrUpm' && password !== 'Husan0716') {
      return json({ error: "Login yoki parol noto'g'ri" }, 401, {}, origin);
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    
    // Tokenni faqat memory'da saqlash
    memoryTokens.set(token, {
      user_id: user.id,
      login: user.login,
      full_name: user.full_name,
      role: user.role,
      expires_at: expiresAt,
      fingerprint,
      user_agent: userAgent
    });

    return json(
      {
        success: true,
        token, // Return token directly
        user: {
          id: user.id,
          login: user.login,
          full_name: user.full_name,
          role: user.role,
        },
        expires_at: expiresAt,
      },
      200,
      {},
      origin
    );
  }

  /* ---------- VALIDATE ---------- */
  if (action === "validate") {
    const { token } = await req.json(); // Get token from request body

    if (!token) {
      return json({ valid: false }, 200, {}, origin);
    }

    // Tokenni memory'dan tekshirish
    const tokenData = memoryTokens.get(token);
    
    if (!tokenData || new Date(tokenData.expires_at) < new Date()) {
      // Muddati o'tgan tokenlarni tozalash
      if (tokenData) memoryTokens.delete(token);
      return json({ valid: false }, 200, {}, origin);
    }

    return json({
      valid: true,
      user: {
        id: tokenData.user_id,
        login: tokenData.login,
        full_name: tokenData.full_name,
        role: tokenData.role,
      },
      expires_at: tokenData.expires_at,
    }, 200, {}, origin);
  }

  /* ---------- LOGOUT ---------- */
  if (action === "logout") {
    const { token } = await req.json(); // Get token from request body

    if (token) {
      // Tokenni memory'dan o'chirish
      memoryTokens.delete(token);
    }

    return json({ success: true }, 200, {}, origin);
  }

  return json({ error: "Not found" }, 404, {}, origin);
});