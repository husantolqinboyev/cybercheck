import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://cybercheck-uni.vercel.app",
  "http://localhost:8080",
  "http://localhost:5173"
];

// Rate limiting - admin so'rovlari uchun
const adminRateLimit = new Map<string, { count: number; resetTime: number }>();
const MAX_ADMIN_REQUESTS = 10; // 10 so'rov daqiqada
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 daqiqa

// Admin amallarini log qilish
interface AdminLog {
  admin_id: string;
  action: string;
  endpoint: string;
  timestamp: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  details?: any;
}

// Permission levels for least privilege
enum AdminPermission {
  READ_USERS = "read_users",
  CREATE_USERS = "create_users", 
  UPDATE_USERS = "update_users",
  DELETE_USERS = "delete_users",
  READ_GROUPS = "read_groups",
  CREATE_GROUPS = "create_groups",
  UPDATE_GROUPS = "update_groups",
  DELETE_GROUPS = "delete_groups",
  READ_SUBJECTS = "read_subjects",
  CREATE_SUBJECTS = "create_subjects",
  UPDATE_SUBJECTS = "update_subjects",
  DELETE_SUBJECTS = "delete_subjects",
  READ_REPORTS = "read_reports",
  MANAGE_ATTENDANCE = "manage_attendance",
  SYSTEM_SETTINGS = "system_settings"
}

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  "super_admin": [
    AdminPermission.READ_USERS,
    AdminPermission.CREATE_USERS,
    AdminPermission.UPDATE_USERS,
    AdminPermission.DELETE_USERS,
    AdminPermission.READ_GROUPS,
    AdminPermission.CREATE_GROUPS,
    AdminPermission.UPDATE_GROUPS,
    AdminPermission.DELETE_GROUPS,
    AdminPermission.READ_SUBJECTS,
    AdminPermission.CREATE_SUBJECTS,
    AdminPermission.UPDATE_SUBJECTS,
    AdminPermission.DELETE_SUBJECTS,
    AdminPermission.READ_REPORTS,
    AdminPermission.MANAGE_ATTENDANCE,
    AdminPermission.SYSTEM_SETTINGS
  ],
  "admin": [
    AdminPermission.READ_USERS,
    AdminPermission.CREATE_USERS,
    AdminPermission.UPDATE_USERS,
    AdminPermission.READ_GROUPS,
    AdminPermission.CREATE_GROUPS,
    AdminPermission.UPDATE_GROUPS,
    AdminPermission.READ_SUBJECTS,
    AdminPermission.CREATE_SUBJECTS,
    AdminPermission.UPDATE_SUBJECTS,
    AdminPermission.READ_REPORTS,
    AdminPermission.MANAGE_ATTENDANCE
  ],
  "moderator": [
    AdminPermission.READ_USERS,
    AdminPermission.UPDATE_USERS,
    AdminPermission.READ_GROUPS,
    AdminPermission.READ_SUBJECTS,
    AdminPermission.READ_REPORTS,
    AdminPermission.MANAGE_ATTENDANCE
  ]
};

// Action to permission mapping
const ACTION_PERMISSIONS: Record<string, AdminPermission> = {
  "create-user": AdminPermission.CREATE_USERS,
  "delete-user": AdminPermission.DELETE_USERS,
  "update-user": AdminPermission.UPDATE_USERS,
  "read-users": AdminPermission.READ_USERS,
  "create-group": AdminPermission.CREATE_GROUPS,
  "delete-group": AdminPermission.DELETE_GROUPS,
  "update-group": AdminPermission.UPDATE_GROUPS,
  "read-groups": AdminPermission.READ_GROUPS,
  "create-subject": AdminPermission.CREATE_SUBJECTS,
  "delete-subject": AdminPermission.DELETE_SUBJECTS,
  "update-subject": AdminPermission.UPDATE_SUBJECTS,
  "read-subjects": AdminPermission.READ_SUBJECTS,
  "read-reports": AdminPermission.READ_REPORTS,
  "manage-attendance": AdminPermission.MANAGE_ATTENDANCE,
  "system-settings": AdminPermission.SYSTEM_SETTINGS
};

// CORS headers
function corsHeaders(origin: string | null = null) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || "") ? origin : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "content-type, authorization, x-admin-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
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

// Rate limiting tekshiruvi
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = adminRateLimit.get(ip);
  
  if (!limit || now > limit.resetTime) {
    adminRateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= MAX_ADMIN_REQUESTS) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Permission validation function
function hasPermission(userRole: string, action: string): boolean {
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  const requiredPermission = ACTION_PERMISSIONS[action];
  
  if (!requiredPermission) {
    return false; // Action not defined
  }
  
  return userPermissions.includes(requiredPermission);
}

// Get user permissions for frontend
function getUserPermissions(userRole: string): AdminPermission[] {
  return ROLE_PERMISSIONS[userRole] || [];
}

// Admin token validation
async function validateAdminToken(token: string, supabase: any): Promise<{ valid: boolean; admin?: any }> {
  if (!token) return { valid: false };
  
  try {
    // Auth funksiyasidan token validation
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auth/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    
    const result = await response.json();
    
    if (!result.valid || result.user.role !== "admin") {
      return { valid: false };
    }
    
    return { valid: true, admin: result.user };
  } catch (error) {
    return { valid: false };
  }
}

// Admin amalini log qilish
async function logAdminAction(log: AdminLog, supabase: any) {
  try {
    await supabase
      .from("admin_logs")
      .insert(log);
  } catch (error) {
    console.error("Admin log error:", error);
  }
}

// CSRF token yaratish va tekshirish
function generateCSRFToken(): string {
  return crypto.randomUUID();
}

function validateCSRFToken(requestedToken: string, sessionToken: string): boolean {
  return requestedToken === sessionToken;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  
  // OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }
  
  // Faqat POST method ruxsat
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, {}, origin);
  }
  
  // Rate limiting tekshiruvi
  if (!checkRateLimit(clientIP)) {
    return json({ error: "Too many requests" }, 429, {}, origin);
  }
  
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: "Server configuration error" }, 500, {}, origin);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Admin tokenini olish
  const adminToken = req.headers.get("x-admin-token");
  
  // Admin validation
  const { valid, admin } = await validateAdminToken(adminToken || "", supabase);
  
  if (!valid || !admin) {
    await logAdminAction({
      admin_id: "unknown",
      action: "unauthorized_access",
      endpoint: action || "unknown",
      timestamp: new Date().toISOString(),
      ip_address: clientIP,
      user_agent: userAgent,
      success: false,
    }, supabase);
    
    return json({ error: "Unauthorized admin access" }, 401, {}, origin);
  }
  
  // CSRF token tekshiruvi (agar kerak bo'lsa)
  const csrfToken = req.headers.get("x-csrf-token");
  if (csrfToken && !validateCSRFToken(csrfToken, adminToken || "")) {
    return json({ error: "Invalid CSRF token" }, 403, {}, origin);
  }
  
  // Admin amallari
  try {
    let result;
    let actionName = "";
    
    // Permission check before executing action
    if (!hasPermission(admin.role, action || "")) {
      await logAdminAction({
        admin_id: admin.id,
        action: "permission_denied",
        endpoint: action || "unknown",
        timestamp: new Date().toISOString(),
        ip_address: clientIP,
        user_agent: userAgent,
        success: false,
        details: { required_permission: ACTION_PERMISSIONS[action || ""] },
      }, supabase);
      
      return json({ error: "Insufficient permissions for this action" }, 403, {}, origin);
    }
    
    switch (action) {
      case "create-user":
        actionName = "create_user";
        const userData = await req.json();
        result = await supabase
          .from("users")
          .insert({
            login: userData.login,
            password_hash: userData.password_hash,
            full_name: userData.full_name,
            role: userData.role,
            is_active: true,
            created_at: new Date().toISOString(),
          })
          .select();
        break;
        
      case "delete-user":
        actionName = "delete_user";
        const { userId } = await req.json();
        result = await supabase
          .from("users")
          .update({ is_active: false })
          .eq("id", userId);
        break;
        
      case "update-user":
        actionName = "update_user";
        const updateData = await req.json();
        const { id: updateId, ...updateFields } = updateData;
        result = await supabase
          .from("users")
          .update(updateFields)
          .eq("id", updateId);
        break;
        
      case "create-group":
        actionName = "create_group";
        const groupData = await req.json();
        result = await supabase
          .from("groups")
          .insert({
            name: groupData.name,
            description: groupData.description,
            created_at: new Date().toISOString(),
          })
          .select();
        break;
        
      default:
        return json({ error: "Action not found" }, 404, {}, origin);
    }
    
    // Amalni log qilish
    await logAdminAction({
      admin_id: admin.id,
      action: actionName,
      endpoint: action || "unknown",
      timestamp: new Date().toISOString(),
      ip_address: clientIP,
      user_agent: userAgent,
      success: true,
      details: result,
    }, supabase);
    
    return json({
      success: true,
      message: "Admin action completed successfully",
      data: result,
    }, 200, {}, origin);
    
  } catch (error) {
    // Xatolikni log qilish
    await logAdminAction({
      admin_id: admin.id,
      action: action || "unknown",
      endpoint: action || "unknown",
      timestamp: new Date().toISOString(),
      ip_address: clientIP,
      user_agent: userAgent,
      success: false,
      details: { error: error.message },
    }, supabase);
    
    return json({ 
      error: "Admin action failed",
      details: error.message 
    }, 500, {}, origin);
  }
});
