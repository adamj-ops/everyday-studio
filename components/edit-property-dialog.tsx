"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PropertyForm, type PropertyFormValues } from "@/components/property-form";
import { updateProperty } from "@/app/actions/properties";

type Props = {
  property: {
    id: string;
  } & PropertyFormValues;
};

export function EditPropertyDialog({ property }: Props) {
  const [open, setOpen] = useState(false);
  const boundAction = updateProperty.bind(null, property.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil />
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit property</DialogTitle>
        </DialogHeader>
        <PropertyForm
          initial={property}
          action={boundAction}
          submitLabel="Save changes"
          successToast="Property updated"
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
