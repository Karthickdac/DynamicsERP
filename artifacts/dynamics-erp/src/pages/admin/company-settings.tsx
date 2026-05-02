import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetCompanySettings, useUpdateCompanySettings, getGetCompanySettingsQueryKey } from "@workspace/api-client-react";
import { uploadFile, objectPathToUrl } from "@/lib/upload-file";

export default function CompanySettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useGetCompanySettings();
  const updateMut = useUpdateCompanySettings();
  const form = useForm<any>({ defaultValues: {} });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const logoUrl: string | null = form.watch("logoUrl") ?? null;
  const logoSrc = objectPathToUrl(logoUrl);

  useEffect(() => {
    if (data) form.reset(data);
  }, [data, form]);

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Logo must be an image", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo too large", description: "Maximum size is 2 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { objectPath } = await uploadFile(file);
      form.setValue("logoUrl", objectPath, { shouldDirty: true });
      toast({ title: "Logo uploaded", description: "Click Save Changes to apply." });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    form.setValue("logoUrl", "", { shouldDirty: true });
  };

  const onSubmit = (values: any) => {
    updateMut.mutate({ data: values }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCompanySettingsQueryKey() });
        toast({ title: "Company settings saved" });
      },
      onError: (err: any) => toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
    });
  };

  if (isLoading) return <div>Loading...</div>;

  const Field = ({ name, label, placeholder, type }: { name: string; label: string; placeholder?: string; type?: string }) => (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type ?? "text"} {...form.register(name)} placeholder={placeholder} data-testid={`field-${name}`} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="page-title">Company Settings</h1>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={updateMut.isPending} data-testid="btn-save">
          {updateMut.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">These details appear on PDFs, invoices, quotations and emails sent from DynamicsERP.</p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-start gap-4">
                <div
                  className="h-20 w-20 rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0"
                  data-testid="logo-preview"
                >
                  {logoSrc ? (
                    <img src={logoSrc} alt="Company logo" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground text-center px-1">No logo</span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoFile}
                      data-testid="input-logo-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      data-testid="btn-upload-logo"
                    >
                      <Upload className="h-4 w-4 mr-1.5" />
                      {uploading ? "Uploading..." : logoUrl ? "Replace Logo" : "Upload Logo"}
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeLogo}
                        disabled={uploading}
                        data-testid="btn-remove-logo"
                      >
                        <X className="h-4 w-4 mr-1.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or SVG up to 2 MB. Appears on PDFs, emails and the sidebar.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field name="name" label="Display Name" placeholder="Dynamic Green Energy" />
              <Field name="legalName" label="Legal Name" placeholder="Dynamic Green Energy Pvt. Ltd." />
              <Field name="tagline" label="Tagline" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field name="email" label="Email" type="email" />
            <Field name="phone" label="Phone" />
            <Field name="website" label="Website" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field name="addressLine1" label="Address Line 1" />
            <Field name="addressLine2" label="Address Line 2" />
            <Field name="city" label="City" />
            <Field name="state" label="State" />
            <Field name="pincode" label="Pincode" />
            <Field name="country" label="Country" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tax Identifiers</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field name="gstin" label="GSTIN" />
            <Field name="pan" label="PAN" />
            <Field name="cin" label="CIN" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bank Details (for Invoice Footer)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field name="bankName" label="Bank Name" />
            <Field name="bankAccountNo" label="Account Number" />
            <Field name="bankIfsc" label="IFSC Code" />
            <Field name="bankBranch" label="Branch" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Document Defaults</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="invoiceFooterNote">Invoice / PDF Footer Note</Label>
              <Textarea id="invoiceFooterNote" rows={3} {...form.register("invoiceFooterNote")} data-testid="field-invoiceFooterNote" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="termsAndConditions">Default Terms & Conditions</Label>
              <Textarea id="termsAndConditions" rows={5} {...form.register("termsAndConditions")} data-testid="field-termsAndConditions" />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
