import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  detail: string;
}

export function StatCard({ icon: Icon, value, label, detail }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-card__icon"><Icon size={18} strokeWidth={1.8} /></div>
      <p className="stat-card__value">{value}</p>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__detail">{detail}</p>
    </article>
  );
}
