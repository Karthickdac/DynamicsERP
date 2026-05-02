import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Send, ShieldCheck, AlertCircle, Loader2, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  useGetEmailSettings,
  useUpdateEmailSettings,
  useTestEmailSettings,
  useTestImapSettings,
  getGetEmailSettingsQueryKey,
} from "@workspace/api-client-react";

type FormValues = {
  provider: "smtp" | "resend" | "none";
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  smtpFromName: string;
  resendApiKey: string;
  resendFrom: string;
  resendFromName: string;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
};

const EMPTY: FormValues = {
  provider: "none",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUser: "",
  smtpPassword: "",
  smtpFrom: "",
  smtpFromName: "",
  resendApiKey: "",
  resendFrom: "",
  resendFromName: "",
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  imapUser: "",
  imapPassword: "",
};

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useGetEmailSettings();
  const updateMut = useUpdateEmailSettings();
  const testMut = useTestEmailSettings();
  const testImapMut = useTestImapSettings();

  const form = useForm<FormValues>({ defaultValues: EMPTY });
  const [testRecipient, setTestRecipient] = useState("");
  const provider = form.watch("provider");

  useEffect(() => {
    if (!data) return;
    form.reset({
      provider: (data.provider as FormValues["provider"]) ?? "none",
      smtpHost: data.smtpHost ?? "",
      smtpPort: data.smtpPort != null ? String(data.smtpPort) : "587",
      smtpSecure: Boolean(data.smtpSecure),
      smtpUser: data.smtpUser ?? "",
      smtpPassword: "",
      smtpFrom: data.smtpFrom ?? "",
      smtpFromName: data.smtpFromName ?? "",
      resendApiKey: "",
      resendFrom: data.resendFrom ?? "",
      resendFromName: data.resendFromName ?? "",
      imapHost: data.imapHost ?? "",
      imapPort: data.imapPort != null ? String(data.imapPort) : "993",
      imapSecure: data.imapSecure ?? true,
      imapUser: data.imapUser ?? "",
      imapPassword: "",
    });
  }, [data, form]);

  const onSubmit = (v: FormValues) => {
    updateMut.mutate(
      {
        data: {
          provider: v.provider,
          smtpHost: v.smtpHost || null,
          smtpPort: v.smtpPort ? Number(v.smtpPort) : null,
          smtpSecure: v.smtpSecure,
          smtpUser: v.smtpUser || null,
          smtpPassword: v.smtpPassword || "",
          smtpFrom: v.smtpFrom || null,
          smtpFromName: v.smtpFromName || null,
          resendApiKey: v.resendApiKey || "",
          resendFrom: v.resendFrom || null,
          resendFromName: v.resendFromName || null,
          imapHost: v.imapHost || null,
          imapPort: v.imapPort ? Number(v.imapPort) : null,
          imapSecure: v.imapSecure,
          imapUser: v.imapUser || null,
          imapPassword: v.imapPassword || "",
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetEmailSettingsQueryKey() });
          form.setValue("smtpPassword", "");
          form.setValue("resendApiKey", "");
          form.setValue("imapPassword", "");
          toast({ title: "Email settings saved" });
        },
        onError: (err: any) =>
          toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
      },
    );
  };

  const onTestImap = () => {
    testImapMut.mutate(undefined as any, {
      onSuccess: (res: any) => {
        toast({
          title: res?.ok ? "IMAP connection OK" : "IMAP test failed",
          description: res?.message,
          variant: res?.ok ? undefined : "destructive",
        });
      },
      onError: (err: any) =>
        toast({ title: "IMAP test failed", description: err?.message, variant: "destructive" }),
    });
  };

  const onSendTest = () => {
    if (!testRecipient) {
      toast({ title: "Enter a recipient email", variant: "destructive" });
      return;
    }
    testMut.mutate(
      { data: { recipient: testRecipient } },
      {
        onSuccess: (res: any) => {
          toast({
            title: res?.ok ? "Test email sent" : "Test email failed",
            description: res?.message,
            variant: res?.ok ? undefined : "destructive",
          });
        },
        onError: (err: any) =>
          toast({ title: "Test failed", description: err?.message, variant: "destructive" }),
      },
    );
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="page-title">
          Email Settings
        </h1>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={updateMut.isPending}
          data-testid="btn-save"
        >
          {updateMut.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure outbound email so DynamicsERP can send invoices, quotations, notifications and other
        documents. Choose a provider and fill in its credentials below.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Provider selection */}
        <Card>
          <CardHeader>
            <CardTitle>Provider</CardTitle>
            <CardDescription>
              Which service should DynamicsERP use to deliver emails?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="provider"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                  data-testid="provider-radio"
                >
                  <Label
                    className="flex items-start gap-3 rounded-md border p-4 cursor-pointer hover:bg-muted/40"
                    htmlFor="provider-smtp"
                  >
                    <RadioGroupItem value="smtp" id="provider-smtp" data-testid="provider-smtp" />
                    <div className="space-y-1">
                      <div className="font-medium">SMTP</div>
                      <div className="text-xs text-muted-foreground">
                        Gmail, Office 365, Zoho, your own mail server.
                      </div>
                    </div>
                  </Label>
                  <Label
                    className="flex items-start gap-3 rounded-md border p-4 cursor-pointer hover:bg-muted/40"
                    htmlFor="provider-resend"
                  >
                    <RadioGroupItem value="resend" id="provider-resend" data-testid="provider-resend" />
                    <div className="space-y-1">
                      <div className="font-medium">Resend</div>
                      <div className="text-xs text-muted-foreground">
                        Hosted email API. Recommended if you don't run your own mail server.
                      </div>
                    </div>
                  </Label>
                  <Label
                    className="flex items-start gap-3 rounded-md border p-4 cursor-pointer hover:bg-muted/40"
                    htmlFor="provider-none"
                  >
                    <RadioGroupItem value="none" id="provider-none" data-testid="provider-none" />
                    <div className="space-y-1">
                      <div className="font-medium">Disabled</div>
                      <div className="text-xs text-muted-foreground">
                        Don't send emails. Messages will be logged as skipped.
                      </div>
                    </div>
                  </Label>
                </RadioGroup>
              )}
            />
          </CardContent>
        </Card>

        {/* SMTP fields */}
        {provider === "smtp" && (
          <Card>
            <CardHeader>
              <CardTitle>SMTP Configuration</CardTitle>
              <CardDescription>
                Server, credentials, and from address used to send mail over SMTP.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field name="smtpHost" label="SMTP Host" placeholder="smtp.gmail.com" form={form} />
                <Field name="smtpPort" label="Port" placeholder="587" form={form} type="number" />
                <Field name="smtpUser" label="Username" placeholder="you@example.com" form={form} />
                <PasswordField
                  name="smtpPassword"
                  label="Password / App Password"
                  isSet={Boolean(data?.smtpPasswordSet)}
                  form={form}
                />
                <Field
                  name="smtpFrom"
                  label="From Address"
                  placeholder="noreply@dynamicgreenenergy.in"
                  form={form}
                  type="email"
                />
                <Field
                  name="smtpFromName"
                  label="From Name (optional)"
                  placeholder="Dynamic Green Energy"
                  form={form}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Controller
                  control={form.control}
                  name="smtpSecure"
                  render={({ field }) => (
                    <Switch
                      id="smtpSecure"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="field-smtpSecure"
                    />
                  )}
                />
                <Label htmlFor="smtpSecure" className="cursor-pointer">
                  Use TLS (port 465). Leave off for STARTTLS on port 587.
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resend fields */}
        {provider === "resend" && (
          <Card>
            <CardHeader>
              <CardTitle>Resend Configuration</CardTitle>
              <CardDescription>
                API key and verified sender for the Resend transactional email service.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PasswordField
                  name="resendApiKey"
                  label="API Key"
                  isSet={Boolean(data?.resendApiKeySet)}
                  form={form}
                />
                <Field
                  name="resendFrom"
                  label="From Address"
                  placeholder="noreply@dynamicgreenenergy.in"
                  form={form}
                  type="email"
                />
                <Field
                  name="resendFromName"
                  label="From Name (optional)"
                  placeholder="Dynamic Green Energy"
                  form={form}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The From domain must be verified in your Resend account, otherwise the email will be
                rejected.
              </p>
            </CardContent>
          </Card>
        )}

        {/* IMAP fields — independent of outbound provider */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" /> IMAP (Read Inbox)
            </CardTitle>
            <CardDescription>
              Optional. Configure IMAP to read messages from the mailbox in the{" "}
              <a className="underline" href="/admin/inbox">Inbox</a> page. Username and password are
              optional — if left blank, the SMTP credentials above are used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field name="imapHost" label="IMAP Host" placeholder="imap.hostinger.com" form={form} />
              <Field name="imapPort" label="Port" placeholder="993" form={form} type="number" />
              <Field
                name="imapUser"
                label="Username (optional, defaults to SMTP user)"
                placeholder="you@example.com"
                form={form}
              />
              <PasswordField
                name="imapPassword"
                label="Password (optional, defaults to SMTP password)"
                isSet={Boolean(data?.imapPasswordSet)}
                form={form}
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Controller
                control={form.control}
                name="imapSecure"
                render={({ field }) => (
                  <Switch
                    id="imapSecure"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="field-imapSecure"
                  />
                )}
              />
              <Label htmlFor="imapSecure" className="cursor-pointer">
                Use TLS (port 993). Leave off only for plain IMAP on port 143.
              </Label>
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onTestImap}
                disabled={testImapMut.isPending}
                data-testid="btn-test-imap"
              >
                {testImapMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Testing IMAP...
                  </>
                ) : (
                  <>
                    <Inbox className="h-4 w-4 mr-1.5" />
                    Test IMAP Connection
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {provider === "none" && (
          <Card>
            <CardContent className="p-6 flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Email delivery is disabled.</p>
                <p className="text-muted-foreground">
                  Send Email actions on invoices, quotations and notifications will be recorded in the
                  email log as <em>skipped</em> until a provider is configured.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </form>

      {/* Test email */}
      <Card>
        <CardHeader>
          <CardTitle>Send a Test Email</CardTitle>
          <CardDescription>
            Save your changes first, then send a test message to confirm everything works.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="test-recipient">Recipient</Label>
              <Input
                id="test-recipient"
                type="email"
                placeholder="you@dynamicgreenenergy.in"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                data-testid="field-test-recipient"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onSendTest}
              disabled={testMut.isPending || provider === "none"}
              data-testid="btn-send-test"
            >
              {testMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  Send Test
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Credentials are stored securely in your database and never returned by the API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type FieldProps = {
  name: keyof FormValues;
  label: string;
  placeholder?: string;
  type?: string;
  form: ReturnType<typeof useForm<FormValues>>;
};

function Field({ name, label, placeholder, type, form }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type ?? "text"}
        {...form.register(name)}
        placeholder={placeholder}
        data-testid={`field-${name}`}
      />
    </div>
  );
}

function PasswordField({
  name,
  label,
  isSet,
  form,
}: {
  name: "smtpPassword" | "resendApiKey" | "imapPassword";
  label: string;
  isSet: boolean;
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  const value = form.watch(name);
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type="password"
        autoComplete="new-password"
        placeholder={isSet ? "•••••••••• (saved — leave blank to keep)" : "Enter value"}
        {...form.register(name)}
        data-testid={`field-${name}`}
      />
      {isSet && !value && (
        <p className="text-xs text-muted-foreground">A value is currently saved. Leave blank to keep it.</p>
      )}
    </div>
  );
}
