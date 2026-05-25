import { createFileRoute, Outlet, Link, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, FolderKanban, BookOpen, Settings, Plus, LogOut, Sparkles, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/library", label: "Growth Library", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("credits, full_name").single();
      return data;
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
          <img src="/brand/app_icon_512.png" alt="ZITA OS" className="h-7 w-7 rounded-lg" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">ZITA OS</span>
        </Link>
        <div className="px-3">
          <Button asChild className="w-full bg-gradient-electric text-primary-foreground shadow-glow hover:opacity-90">
            <Link to="/projects/new"><Plus className="h-4 w-4" />New Project</Link>
          </Button>
        </div>
        <nav className="mt-6 flex-1 space-y-1 px-3">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/dashboard" && pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to} className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center justify-between rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-mono font-semibold text-sidebar-foreground">{profile?.credits ?? "—"}</span>
              <span className="text-sidebar-foreground/60">credits</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 px-1 text-xs text-sidebar-foreground/60">
            <Sparkles className="h-3 w-3" />
            <span className="truncate">{email}</span>
          </div>
          <button onClick={signOut} className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/50">
            <LogOut className="h-3 w-3" />Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/brand/app_icon_512.png" alt="ZITA OS" className="h-7 w-7 rounded-md" />
            <span className="font-bold">ZITA OS</span>
          </Link>
          <div className="flex items-center gap-1 text-xs"><Coins className="h-3 w-3 text-primary" /><span className="font-mono">{profile?.credits ?? "—"}</span></div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
