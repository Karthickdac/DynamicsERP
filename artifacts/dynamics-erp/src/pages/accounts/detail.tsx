import { useGetAccount, getGetAccountQueryKey, useListContacts, getListContactsQueryKey, useListLeads, getListLeadsQueryKey, useUpdateAccount, useDeleteAccount } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR, formatDate } from "@/lib/format";
import { Trash2, Edit } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const editAccountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  accountType: z.enum(["residential", "commercial", "industrial", "government"]),
  industry: z.string().optional(),
  gstin: z.string().optional(),
  billingAddress: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
});

export default function AccountDetail() {
  const [, params] = useRoute("/accounts/:id");
  const accountId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: account, isLoading: accountLoading } = useGetAccount(accountId, {
    query: { enabled: !!accountId, queryKey: getGetAccountQueryKey(accountId) }
  });

  const { data: allContacts, isLoading: contactsLoading } = useListContacts({ accountId }, {
    query: { enabled: !!accountId, queryKey: getListContactsQueryKey({ accountId }) }
  });
  const contacts = allContacts;

  const { data: allLeads, isLoading: leadsLoading } = useListLeads(undefined, {
    query: { enabled: !!accountId, queryKey: getListLeadsQueryKey() }
  });
  const leads = allLeads?.filter(l => l.accountId === accountId);

  const [editOpen, setEditOpen] = useState(false);
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();

  const form = useForm<z.infer<typeof editAccountSchema>>({
    resolver: zodResolver(editAccountSchema),
    values: {
      name: account?.name || "",
      accountType: (account?.accountType as any) || "residential",
      industry: account?.industry || "",
      gstin: account?.gstin || "",
      billingAddress: account?.billingAddress || "",
      billingCity: account?.billingCity || "",
      billingState: account?.billingState || "",
    }
  });

  const onEdit = (values: z.infer<typeof editAccountSchema>) => {
    updateMutation.mutate({ id: accountId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
        setEditOpen(false);
        toast({ title: "Account updated" });
      }
    });
  };

  const onDelete = () => {
    deleteMutation.mutate({ id: accountId } as any, {
      onSuccess: () => {
        toast({ title: "Account deleted" });
        setLocation("/accounts");
      }
    });
  };

  if (accountLoading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!account) return <div>Account not found</div>;

  return (
    <div className="space-y-6" data-testid="page-account-detail">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="capitalize">{account.accountType}</Badge>
            {account.industry && <span className="text-sm text-muted-foreground">{account.industry}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="btn-edit-account"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Account</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEdit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-edit-account-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="residential">Residential</SelectItem>
                            <SelectItem value="commercial">Commercial</SelectItem>
                            <SelectItem value="industrial">Industrial</SelectItem>
                            <SelectItem value="government">Government</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gstin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GSTIN</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="billingCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="btn-delete-account"><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">GSTIN</h4>
                <p className="mt-1">{account.gstin || "-"}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Industry</h4>
                <p className="mt-1">{account.industry || "-"}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Website</h4>
                <p className="mt-1">{account.website || "-"}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Created At</h4>
                <p className="mt-1">{formatDate(account.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Billing Address</CardTitle>
            </CardHeader>
            <CardContent>
              {account.billingAddress || account.billingCity || account.billingState ? (
                <div className="space-y-1">
                  {account.billingAddress && <p>{account.billingAddress}</p>}
                  <p>{[account.billingCity, account.billingState, account.billingPincode].filter(Boolean).join(", ")}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No billing address provided.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Contacts</CardTitle>
              <Button asChild size="sm">
                <Link href="/contacts">Add Contact</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactsLoading ? (
                    <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>
                  ) : contacts?.length ? (
                    contacts.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link href={`/contacts/${c.id}`} className="text-primary hover:underline">
                            {c.firstName} {c.lastName} {c.isPrimary && <Badge variant="outline" className="ml-2">Primary</Badge>}
                          </Link>
                        </TableCell>
                        <TableCell>{c.title || "-"}</TableCell>
                        <TableCell>{c.email || "-"}</TableCell>
                        <TableCell>{c.phone || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-4">No contacts found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Expected Close</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? (
                    <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>
                  ) : leads?.length ? (
                    leads.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Link href={`/leads/${l.id}`} className="text-primary hover:underline">
                            {l.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{l.status.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>{formatINR(l.estimatedValue)}</TableCell>
                        <TableCell>{formatDate(l.expectedCloseDate)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-4">No leads found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
