import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";

export interface User {
  id: string;
  login: string;
  full_name: string;
  role: "admin" | "teacher" | "student";
  is_active: boolean;
}

export interface Session {
  token: string;
  user: User;
  expires_at: string;
}

const SESSION_KEY = "cybercheck_session";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// XSS Protection - Sanitize all inputs
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";
  return DOMPurify.sanitize(input.trim(), { ALLOWED_TAGS: [] });
}

// Generate secure random token
export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Generate 6-digit PIN
export function generatePIN(): string {
  const array = new Uint8Array(3);
  crypto.getRandomValues(array);
  const num = ((array[0] << 16) | (array[1] << 8) | array[2]) % 1000000;
  return num.toString().padStart(6, "0");
}

// Get browser fingerprint (simplified)
export async function getFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.maxTouchPoints || 0,
  ];
  
  const data = components.join("|");
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Detect if running on mobile
export function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = ["android", "iphone", "ipad", "ipod", "mobile", "webos"];
  return mobileKeywords.some((keyword) => userAgent.includes(keyword));
}

// Detect if browser is allowed
export function isAllowedBrowser(role: "admin" | "teacher" | "student"): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const isChrome = userAgent.includes("chrome") && !userAgent.includes("edg");
  const isSafari = userAgent.includes("safari") && !userAgent.includes("chrome");
  const isMobile = isMobileDevice();

  if (role === "student") {
    // Students: Only mobile Chrome or Safari
    return isMobile && (isChrome || isSafari);
  } else {
    // Teachers and Admin: Desktop Chrome, or Mobile Chrome/Safari
    return isChrome || (isMobile && isSafari);
  }
}

// Memory-only session storage (refresh qilinsa o'chadi)
let currentSession: Session | null = null;

// Get current session from memory
export function getCurrentSession(): Session | null {
  return currentSession;
}

// Save session to memory only
export function saveSession(session: Session): void {
  currentSession = session;
}

// Clear session from memory
export function clearSession(): void {
  currentSession = null;
}

// Login function with HTTP-only cookie support
export async function login(
  loginInput: string,
  password: string,
  fingerprint: string
): Promise<{ success: boolean; session?: Session; error?: string }> {
  const sanitizedLogin = sanitizeInput(loginInput);
  const sanitizedPassword = sanitizeInput(password);

  if (!sanitizedLogin || !sanitizedPassword) {
    return { success: false, error: "Login va parol to'ldirilishi shart" };
  }

  // Check browser before making request
  // We'll get the role after login, so do a preliminary check
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login: sanitizedLogin,
        password: sanitizedPassword,
        fingerprint,
        userAgent: navigator.userAgent,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return { success: false, error: result.error || "Login xatosi" };
    }

    // Check browser compatibility after getting role
    if (!isAllowedBrowser(result.user.role)) {
      // Logout since we already logged in
      await fetch(`${SUPABASE_URL}/functions/v1/auth/logout`, {
        method: "POST",
      });
      return { 
        success: false, 
        error: result.user.role === "student" 
          ? "Talabalar faqat mobil brauzerdan (Chrome/Safari) foydalanishlari mumkin"
          : "Ruxsat berilmagan brauzer"
      };
    }

    const session: Session = {
      token: result.token, // Store token from server response
      user: result.user,
      expires_at: result.expires_at,
    };

    // Save to memory for UI state and auth validation
    saveSession(session);
    
    return { success: true, session };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Tizim xatosi" };
  }
}

// Logout function with token support
export async function logout(): Promise<void> {
  try {
    const localSession = getCurrentSession();
    const token = localSession?.token || "";
    
    await fetch(`${SUPABASE_URL}/functions/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    console.error("Logout error:", error);
  }
  clearSession();
}

// Validate current session via token
export async function validateSession(): Promise<{ valid: boolean; user?: User; expires_at?: string }> {
  // First check memory for quick UI state
  const localSession = getCurrentSession();
  
  try {
    // Get token from memory session
    const token = localSession?.token || "";
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/auth/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    const result = await response.json();

    if (!result.valid) {
      clearSession();
      return { valid: false };
    }

    // Update memory session with server data
    const session: Session = {
      token: token, // Keep the same token
      user: result.user,
      expires_at: result.expires_at,
    };
    saveSession(session);

    return { valid: true, user: result.user, expires_at: result.expires_at };
  } catch (error) {
    console.error("Session validation error:", error);
    // Fall back to memory if server is unreachable
    if (localSession) {
      return { valid: true, user: localSession.user, expires_at: localSession.expires_at };
    }
    return { valid: false };
  }
}
