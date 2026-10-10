"use client";

import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  ChartColumnBig,
  Clock3,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Stethoscope,
  UserCircle,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { hasAuthenticatedDemoSession } from "@/lib/demo-auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/predict", label: "Predict", icon: Activity },
  { href: "/predict?mode=csv", label: "CSV Prediction", icon: FileSpreadsheet },
  { href: "/history", label: "History", icon: Clock3 },
  { href: "/models", label: "Model", icon: ChartColumnBig },
  { href: "/profile", label: "Profile", icon: UserCircle },
] as const;

function AppNavigation({
  className,
  onNavigate,
}: {
  className: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const csvMode = searchParams.get("mode") === "csv";

  return (
    <nav className={className} aria-label="Main navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isCsvLink = href === "/predict?mode=csv";
        const isPredictLink = href === "/predict";
        const isActive = isCsvLink
          ? pathname === "/predict" && csvMode
          : isPredictLink
            ? pathname === "/predict" && !csvMode
            : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`app-header__nav-item ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function AppShell({ title, subtitle, children, action }: AppShellProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(false);

  useEffect(() => {
    const verificationTimer = window.setTimeout(() => {
      try {
        if (hasAuthenticatedDemoSession()) {
          setSessionVerified(true);
        } else {
          router.replace("/login");
        }
      } catch (error) {
        console.error("Demo account session could not be verified.", error);
        window.localStorage.removeItem("cardio-demo-auth");
        router.replace("/login");
      }
    }, 0);

    return () => window.clearTimeout(verificationTimer);
  }, [router]);

  if (!sessionVerified) {
    return <main className="auth-page" role="status">Checking registered account...</main>;
  }

  return (
    <div className="app-shell">
      <header className="app-header" aria-label="Application header">
        <div className="app-header__brand">
          <div className="brand-mark">
            <Stethoscope size={18} />
          </div>
          <div>
            <span className="brand-name">Heart Disease Prediction</span>
            <span className="brand-subtitle">Machine learning-based clinical research interface</span>
          </div>
        </div>

        <Suspense fallback={<nav className="app-header__nav" aria-label="Main navigation" />}>
          <AppNavigation className="app-header__nav" />
        </Suspense>

        <button
          type="button"
          className="app-header__toggle"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {mobileMenuOpen ? (
        <motion.div
          className="app-header__mobile-nav"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Suspense fallback={<nav aria-label="Mobile navigation" />}>
            <AppNavigation className="app-header__mobile-nav-links" onNavigate={() => setMobileMenuOpen(false)} />
          </Suspense>
        </motion.div>
      ) : null}

      <div className="app-shell__body">
        <main className="app-main">
          <motion.div
            className="page-header"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div>
              <p className="eyebrow"><span className="eyebrow__line" /> Research console</p>
              <h1>{title}</h1>
              {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
            </div>

            {action ? <div className="page-header__action">{action}</div> : null}
          </motion.div>

          <div className="app-page-content">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function SectionIntro({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="section-intro">
      <p className="eyebrow"><span className="eyebrow__line" /> {eyebrow}</p>
      <div className="section-intro__row">
        <h2>{title}</h2>
        {detail ? <span className="section-intro__detail">{detail}</span> : null}
      </div>
    </div>
  );
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function OverviewCard({
  title,
  value,
  hint,
  action,
}: {
  title: string;
  value: string;
  hint?: string;
  action?: string;
}) {
  return (
    <div className="overview-card">
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
      {hint ? <small>{hint}</small> : null}
      {action ? (
        <Link href="/predict" className="overview-card__action">
          {action} <ArrowRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

export function InfoPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-panel">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function StatusBadge({ children }: { children: ReactNode }) {
  return <span className="status-badge"><ShieldCheck size={12} /> {children}</span>;
}
