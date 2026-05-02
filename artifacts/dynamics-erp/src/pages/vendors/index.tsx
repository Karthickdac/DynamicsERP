import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVendors, getListVendorsQueryKey, useCreateVendor,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";

const schema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
});

export default function Vendors() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: vendors, isLoading } = useListVendors({ ...(search ? { search } : {}) } as any);
  const createMutation = useCreateVendor();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", name: "", gstin: "", pan: "", contactPerson: "", email: "", phone: "", city: "", state: "", category: "" },
  });

  const onSubmit = (v: z.infer<typeof schema>) => {
    createMutation.mutate({
      data: {
        code: v.code, name: v.name,
        gstin: v.gstin || null, pan: v.pan || null,
        contactPerson: v.contactPerson || null, email: v.email || null, phone: v.phone || null,
        city: v.city || null, state: v.state || null, category: v.category || null,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Vendor created" });
        queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        setOpen(false); form.reset();
      },
      onError: (err: any) => toast({ title: "Failed", description: err?.message ?? "", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendors</h1>
          <p className="text-muted-foreground">Suppliers and procurement partners</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="btn-new-vendor"><Plus className="mr-2 h-4 w-4" />New Vendor</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create Vendor</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} placeholder="VND-001" data-testid="input-code" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} data-testid="input-name" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="pan" render={({ field }) => (<FormItem><FormLabel>PAN</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                <div className="grid grid-cols-3 gap-3">
                  <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} placeholder="Maharashtra" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} placeholder="Solar Panels" /></FormControl></FormItem>)} />
                </div>
                <DialogFooter><Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-vendor">Create</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" data-testid="input-search" />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : vendors && vendors.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>GSTIN</TableHead>
                <TableHead>State</TableHead><TableHead>Category</TableHead><TableHead>Contact</TableHead>
                <TableHead>Status</TableHead><TableHead>Created</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {vendors.map(v => (
                  <TableRow key={v.id} data-testid={`row-vendor-${v.id}`}>
                    <TableCell><Link href={`/vendors/${v.id}`} className="font-mono text-primary hover:underline">{v.code}</Link></TableCell>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="font-mono text-xs">{v.gstin ?? "-"}</TableCell>
                    <TableCell>{v.state ?? "-"}</TableCell>
                    <TableCell>{v.category ?? "-"}</TableCell>
                    <TableCell>{v.contactPerson ?? "-"}{v.phone ? ` · ${v.phone}` : ""}</TableCell>
                    <TableCell>{v.isActive ? <Badge variant="outline" className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell>{formatDate(v.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Truck className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No vendors yet. Add your first supplier.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
