import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sun, Zap, BarChart3, Wrench, ShieldCheck, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    setLocation("/");
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLogin();

  function onSubmit(values: z.infer<typeof formSchema>) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          toast({ title: "Logged in successfully" });
          setLocation("/");
        },
        onError: () => {
          toast({ title: "Login failed", variant: "destructive" });
        },
      }
    );
  }

  const features = [
    { icon: Sun, title: "Solar Project Lifecycle", desc: "Lead → Quote → Site Survey → Installation → Service, all in one place." },
    { icon: BarChart3, title: "Real-time Dashboards", desc: "Pipeline value, kW commissioned, AMC renewals at a glance." },
    { icon: Wrench, title: "Service & AMC", desc: "Track tickets, technicians, spare parts and maintenance contracts." },
    { icon: ShieldCheck, title: "Role-based Access", desc: "Sales, Project, Finance, HR & Service — each sees only what they need." },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50 dark:bg-gray-950">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-emerald-600 via-green-600 to-emerald-800 text-white p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-yellow-300/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 backdrop-blur p-2.5 rounded-xl ring-1 ring-white/25">
              <Leaf className="h-7 w-7" />
            </div>
            <div>
              <div className="text-lg font-semibold leading-tight">Dynamic Green Energy</div>
              <div className="text-xs text-emerald-100/90">Solar Projects ERP</div>
            </div>
          </div>

          <div className="mt-16 max-w-md">
            <h1 className="text-4xl font-bold leading-tight">
              Power your solar business <span className="text-yellow-300">end-to-end.</span>
            </h1>
            <p className="mt-4 text-emerald-50/90 leading-relaxed">
              From the first lead to the last AMC visit — manage every kilowatt your team
              quotes, installs and services from a single secure workspace.
            </p>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-xl">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 ring-1 ring-white/15">
                <f.icon className="h-5 w-5 text-yellow-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">{f.title}</div>
                  <div className="text-xs text-emerald-50/85 leading-snug mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-xs text-emerald-100/80 pt-8">
          <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Built for India</span>
          <span>•</span>
          <span>GST-ready invoicing</span>
          <span>•</span>
          <span>© {new Date().getFullYear()} Dynamic Green Energy</span>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile-only brand header */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="bg-emerald-600 text-white p-2 rounded-lg">
            <Leaf className="h-5 w-5" />
          </div>
          <div className="font-semibold text-lg">Dynamic Green Energy</div>
        </div>

        <Card className="w-full max-w-md shadow-lg" data-testid="card-login">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to access your ERP workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@dynamicgreenenergy.in" type="email" autoComplete="email" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input placeholder="••••••••" type="password" autoComplete="current-password" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-submit">
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline" data-testid="link-register">
                Create account
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-xs text-muted-foreground mt-6 text-center max-w-md">
          By signing in you agree to follow your organisation's acceptable use and data
          handling policies.
        </p>
      </div>
    </div>
  );
}
