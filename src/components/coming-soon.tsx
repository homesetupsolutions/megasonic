import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <Card><CardContent className="py-10 text-center text-muted-foreground">{desc}</CardContent></Card>
    </div>
  );
}
