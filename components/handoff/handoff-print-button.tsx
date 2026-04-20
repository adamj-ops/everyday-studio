"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HandoffPrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="mr-2 size-4" aria-hidden />
      Download PDF
    </Button>
  );
}
