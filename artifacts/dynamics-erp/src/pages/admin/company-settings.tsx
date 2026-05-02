import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetCompanySettings, useUpdateCompanySettings, getGetCompanySettingsQueryKey } from "@workspace/api-client-react";

export default function CompanySettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useGetCompanySettings();
  const updateMut = useUpdateCompanySettings();
  const form = useForm<any>({ defaultValues: {} });

  useEffect(() => {
    if (data) form.reset(data);
  }, [data, form]);

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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field name="name" label="Display Name" placeholder="Dynamic Green Energy" />
            <Field name="legalName" label="Legal Name" placeholder="Dynamic Green Energy Pvt. Ltd." />
            <Field name="tagline" label="Tagline" />
            <Field name="logoUrl" label="Logo URL" />
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
