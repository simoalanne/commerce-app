import { isDefinedError } from "@rest-rpc/core";
import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { queryUtils } from "@/context/ApiClientContext";

export default function GrantAdminPage() {
  const mutation = useMutation(queryUtils.admins.grantAdmin.mutationOptions());
  const [clerkId, setClerkId] = useState("");

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    mutation.mutate(
      { body: { clerkId } },
      {
        onSuccess() {
          toast.success("Admin access granted");
          setClerkId("");
        },
        onError(error) {
          if (isDefinedError(error) && error.code === "ALREADY_ADMIN") {
            toast.error("User is already an admin!");
          } else if (isDefinedError(error) && error.code === "USER_NOT_FOUND") {
            toast.error(
              "User account not found in database. The user must sign in to the app first before you can grant them admin access.",
            );
          } else {
            toast.error(`Failed: ${error.message || "Unknown error"}`);
          }
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Grant Admin Access</h1>
      <Field>
        <FieldLabel htmlFor="clerk-id">Clerk User ID</FieldLabel>
        <Input
          id="clerk-id"
          placeholder="user_xxxxxxxxxxxxxxxxxx"
          value={clerkId}
          onChange={(e) => setClerkId(e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={mutation.isPending || !clerkId}>
        {mutation.isPending ? "Granting..." : "Grant Admin"}
      </Button>
    </form>
  );
}
