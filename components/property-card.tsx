import Link from "next/link";
import { formatDistanceToNow } from "@/lib/format-date";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { buyerPersonaLabel, formatUsd } from "@/lib/specs/property";

type Props = {
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    arv_estimate: number | null;
    buyer_persona: string | null;
    updated_at: string;
  };
  photoCount: number;
};

export function PropertyCard({ property, photoCount }: Props) {
  return (
    <Link href={`/properties/${property.id}`} className="block">
      <Card className="hover:bg-muted/30 transition-colors">
        <CardHeader>
          <CardTitle className="truncate">{property.address}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {property.city}, {property.state} {property.zip}
          </p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">ARV</dt>
            <dd className="text-right">{formatUsd(property.arv_estimate)}</dd>
            <dt className="text-muted-foreground">Buyer</dt>
            <dd className="text-right truncate">
              {buyerPersonaLabel(property.buyer_persona)}
            </dd>
            <dt className="text-muted-foreground">Photos</dt>
            <dd className="text-right">{photoCount}</dd>
          </dl>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Updated {formatDistanceToNow(new Date(property.updated_at))} ago
        </CardFooter>
      </Card>
    </Link>
  );
}
