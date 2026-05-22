import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const search = z.object({ mode: z.enum(["signin", "signup"]).default("signin") });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Welcome to ZITA OS — 100 credits loaded.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-electric shadow-glow">
            <span className="text-sm font-bold text-primary-foreground">Z</span>
          </div>
          <span className="text-xl font-bold tracking-tight">ZITA OS</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-bold">{isSignup ? "Claim founder access" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup ? "100 credits loaded on signup. Lifetime founder price $47." : "Sign in to your ZITA OS workspace."}
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {isSignup && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-electric text-primary-foreground shadow-glow hover:opacity-90">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have access? " : "New here? "}
            <Link to="/auth" search={{ mode: isSignup ? "signin" : "signup" }} className="text-primary hover:underline">
              {isSignup ? "Sign in" : "Claim founder access"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
