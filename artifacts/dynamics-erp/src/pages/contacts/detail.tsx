import { useGetContact, getGetContactQueryKey, useUpdateContact, useDeleteContact, useListAccounts } from "@workspace/api-client-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Edit, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const editContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  accountId: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
});

export default function ContactDetail() {
  const [, params] = useRoute("/contacts/:id");
  const contactId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contact, isLoading: contactLoading } = useGetContact(contactId, {
    query: { enabled: !!contactId, queryKey: getGetContactQueryKey(contactId) }
  });

  const { data: accounts } = useListAccounts();

  const [editOpen, setEditOpen] = useState(false);
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();

  const form = useForm<z.infer<typeof editContactSchema>>({
    resolver: zodResolver(editContactSchema),
    values: {
      firstName: contact?.firstName || "",
      lastName: contact?.lastName || "",
      accountId: contact?.accountId ? contact.accountId.toString() : "_none",
      title: contact?.title || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
    }
  });

  const onEdit = (values: z.infer<typeof editContactSchema>) => {
    const payload = {
      ...values,
      email: values.email || undefined,
      accountId: values.accountId === "_none" || !values.accountId ? undefined : parseInt(values.accountId)
    };

    updateMutation.mutate({ id: contactId, data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContactQueryKey(contactId) });
        setEditOpen(false);
        toast({ title: "Contact updated" });
      }
    });
  };

  const onDelete = () => {
    deleteMutation.mutate({ id: contactId } as any, {
      onSuccess: () => {
        toast({ title: "Contact deleted" });
        setLocation("/contacts");
      }
    });
  };

  if (contactLoading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!contact) return <div>Contact not found</div>;

  return (
    <div className="space-y-6" data-testid="page-contact-detail">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{contact.firstName} {contact.lastName}</h1>
          <div className="flex items-center gap-2 mt-2">
            {contact.title && <span className="text-sm text-muted-foreground">{contact.title}</span>}
            {contact.isPrimary && <Badge variant="secondary">Primary Contact</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="btn-edit-contact"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Contact</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEdit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl><Input {...field} data-testid="input-edit-firstname" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl><Input {...field} data-testid="input-edit-lastname" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {accounts?.map(acc => (
                              <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="btn-delete-contact"><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the contact.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
              <p className="mt-1">{contact.email || "-"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Phone</h4>
              <p className="mt-1">{contact.phone || "-"}</p>
            </div>
          </CardContent>
        </Card>
        
        {contact.accountId && (
          <Card>
            <CardHeader>
              <CardTitle>Associated Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <Link href={`/accounts/${contact.accountId}`} className="text-primary hover:underline font-medium block">
                    {accounts?.find(a => a.id === contact.accountId)?.name || "View Account"}
                  </Link>
                  <p className="text-sm text-muted-foreground">Customer Account</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
