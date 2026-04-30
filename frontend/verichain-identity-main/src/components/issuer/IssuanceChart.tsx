import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import type { IssuedCredential } from "./IssuedCredentialsTable";

interface Props {
  credentials: IssuedCredential[];
}

export function IssuanceChart({ credentials }: Props) {
  const years = useMemo(() => {
    const set = new Set(credentials.map((c) => new Date(c.issuedAt).getFullYear()));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [credentials]);

  const [year, setYear] = useState(years[0]);

  const data = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleDateString("fr-FR", { month: "short" }),
      count: 0,
    }));
    credentials.forEach((c) => {
      const d = new Date(c.issuedAt);
      if (d.getFullYear() === year) months[d.getMonth()].count += 1;
    });
    return months;
  }, [credentials, year]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Émissions par mois</h3>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={10} stroke="var(--color-muted-foreground)" />
            <YAxis tickLine={false} axisLine={false} fontSize={10} stroke="var(--color-muted-foreground)" allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--color-secondary)" }}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}