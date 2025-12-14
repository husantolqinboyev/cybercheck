declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  export function createClient(...args: any[]): any;
  export default createClient;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(...args: any[]): any;
  export default createClient;
}

declare module "https://esm.sh/@supabase/supabase-js" {
  export function createClient(...args: any[]): any;
  export default createClient;
}

declare module "https://deno.land/x/bcrypt@v0.4.1/mod.ts" {
  export const bcrypt: {
    compare: (plain: string, hash: string) => Promise<boolean>;
    hash?: (s: string) => Promise<string>;
  };
}

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get(name: string): string | undefined };
};
