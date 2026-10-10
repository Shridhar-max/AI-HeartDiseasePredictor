"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Edit3,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell, SectionIntro, StatusBadge } from "@/components/app-shell";
import { fetchHistory, PredictionApiError, type HistoryRecord } from "@/lib/api";

type ProfileFields = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  institution: string;
};

const defaultProfile: ProfileFields = {
  fullName: "Research User",
  email: "",
  phone: "Not provided",
  role: "Research User",
  institution: "Heart Disease Prediction Lab",
};

function formatTimestamp(input: string) {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) {
    return "No recent prediction";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileFields>(() => {
    if (typeof window === "undefined") {
      return defaultProfile;
    }

    const savedProfile = window.localStorage.getItem("cardio-profile");
    if (!savedProfile) {
      return defaultProfile;
    }

    try {
      const parsed = JSON.parse(savedProfile) as Partial<ProfileFields>;
      return { ...defaultProfile, ...parsed };
    } catch {
      return defaultProfile;
    }
  });
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cardio-profile", JSON.stringify(profile));
    }
  }, [profile]);

  useEffect(() => {
    let isMounted = true;

    fetchHistory()
      .then((records) => {
        if (isMounted) {
          setHistory(records);
          setHistoryError(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setHistoryError(error instanceof PredictionApiError ? error.message : "Prediction history is unavailable.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const parts = profile.fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return "RU";
    }
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "RU";
  }, [profile.fullName]);

  const totalPredictions = history.length;
  const csvPredictions = history.filter((record) => record.prediction_type === "CSV").length;
  const recentPrediction = history[0] ? `${history[0].prediction_label} • ${formatTimestamp(history[0].prediction_timestamp)}` : "No saved predictions";
  const savedHistory = history.length === 0 ? "0 saved records" : `${history.length} saved records`;

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("cardio-demo-auth");
    }
    router.push("/login");
  }

  function handleEditProfile() {
    const element = document.getElementById("profile-form");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = element.querySelector("input");
      firstField?.focus();
    }
  }

  function updateField(field: keyof ProfileFields, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <AppShell
      title="Profile"
      subtitle="Manage your account, review your prediction activity, and configure your application preferences."
      action={
        <button type="button" className="secondary-button" onClick={handleEditProfile}>
          <Edit3 size={14} /> Edit profile
        </button>
      }
    >
      <section className="profile-page">
        <div className="profile-header-card">
          <div className="profile-header-card__identity">
            <div className="profile-avatar" aria-label="User avatar">
              {initials}
            </div>

            <div className="profile-header-card__details">
              <div className="profile-header-card__meta">
                <StatusBadge>{profile.role || "Research User"}</StatusBadge>
              </div>
              <h2>{profile.fullName || "Research User"}</h2>
              <p>{profile.email || "No email available"}</p>
              <div className="profile-header-card__chips">
                <span>
                  <ShieldCheck size={12} />
                  Account active
                </span>
                <span>
                  <CalendarDays size={12} />
                  Research access
                </span>
              </div>
            </div>
          </div>

          <div className="profile-header-card__actions">
            <button type="button" className="secondary-button" onClick={handleEditProfile}>
              <Edit3 size={14} /> Edit Profile
            </button>
          </div>
        </div>

        <div className="profile-main-grid">
          <section className="content-card profile-panel">
            <SectionIntro eyebrow="Profile" title="Personal information" detail="Research account" />

            <form id="profile-form" className="profile-form" noValidate>
              <div className="profile-form-grid">
                <label className="profile-field" htmlFor="full-name">
                  <span>Full Name</span>
                  <div className="profile-input-wrap">
                    <UserRound size={15} />
                    <input
                      id="full-name"
                      type="text"
                      value={profile.fullName}
                      onChange={(event) => updateField("fullName", event.target.value)}
                      aria-label="Full name"
                    />
                  </div>
                </label>

                <label className="profile-field" htmlFor="email-address">
                  <span>Email Address</span>
                  <div className="profile-input-wrap">
                    <Mail size={15} />
                    <input
                      id="email-address"
                      type="email"
                      value={profile.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      aria-label="Email address"
                    />
                  </div>
                </label>

                <label className="profile-field" htmlFor="phone-number">
                  <span>Phone Number</span>
                  <div className="profile-input-wrap">
                    <Phone size={15} />
                    <input
                      id="phone-number"
                      type="tel"
                      value={profile.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      aria-label="Phone number"
                      placeholder="Not provided"
                    />
                  </div>
                </label>

                <label className="profile-field" htmlFor="role">
                  <span>Role</span>
                  <div className="profile-input-wrap">
                    <BriefcaseBusiness size={15} />
                    <input
                      id="role"
                      type="text"
                      value={profile.role}
                      onChange={(event) => updateField("role", event.target.value)}
                      aria-label="Role"
                    />
                  </div>
                </label>

                <label className="profile-field profile-field--full" htmlFor="institution">
                  <span>Institution / Organization</span>
                  <div className="profile-input-wrap">
                    <Building2 size={15} />
                    <input
                      id="institution"
                      type="text"
                      value={profile.institution}
                      onChange={(event) => updateField("institution", event.target.value)}
                      aria-label="Institution or organization"
                      placeholder="Not provided"
                    />
                  </div>
                </label>
              </div>
            </form>
          </section>

          <aside className="profile-side-stack">
            <section className="content-card profile-panel">
              <SectionIntro eyebrow="Activity" title="Overview" detail="Live data" />

              {loading ? (
                <div className="profile-loading-state" aria-live="polite">
                  <LoaderCircle size={18} className="loading-spinner" />
                  Loading prediction activity...
                </div>
              ) : historyError ? (
                <div className="profile-message profile-message--error" role="alert">
                  {historyError}
                </div>
              ) : (
                <div className="profile-stat-grid">
                  <div className="profile-stat-card">
                    <span>Total Predictions</span>
                    <strong>{totalPredictions}</strong>
                    <small>Saved in backend history</small>
                  </div>

                  <div className="profile-stat-card">
                    <span>CSV Predictions</span>
                    <strong>{csvPredictions}</strong>
                    <small>Batch uploads processed</small>
                  </div>

                  <div className="profile-stat-card">
                    <span>Recent Prediction</span>
                    <strong>{history.length ? history[0].prediction_label : "—"}</strong>
                    <small>{history.length ? formatTimestamp(history[0].prediction_timestamp) : "No recent result"}</small>
                  </div>

                  <div className="profile-stat-card">
                    <span>Saved History</span>
                    <strong>{savedHistory}</strong>
                    <small>{history.length ? recentPrediction : "No stored records"}</small>
                  </div>
                </div>
              )}
            </section>

            <section className="content-card profile-panel">
              <SectionIntro eyebrow="Preferences" title="Prediction settings" detail="Current app state" />

              <div className="profile-toggle-list">
                <label className="profile-toggle" htmlFor="save-history">
                  <span>Save Prediction History</span>
                  <input id="save-history" type="checkbox" checked readOnly disabled />
                </label>

                <label className="profile-toggle" htmlFor="show-confidence">
                  <span>Show Prediction Confidence</span>
                  <input id="show-confidence" type="checkbox" checked readOnly disabled />
                </label>

                <label className="profile-toggle" htmlFor="show-probabilities">
                  <span>Show Class Probabilities</span>
                  <input id="show-probabilities" type="checkbox" checked readOnly disabled />
                </label>
              </div>

              <p className="profile-helper">
                Preferences are currently controlled by the active application and the backend does not expose a dedicated settings store.
              </p>
            </section>
          </aside>
        </div>

        <div className="profile-bottom-grid">
          <section className="content-card profile-panel">
            <SectionIntro eyebrow="Security" title="Account controls" detail="Prototype access" />

            <div className="profile-security-actions">
              <button type="button" className="secondary-button" disabled aria-label="Change password not available in this prototype">
                <KeyRound size={14} /> Change Password
              </button>

              <button type="button" className="primary-button" onClick={handleLogout}>
                <LogOut size={14} /> Logout
              </button>
            </div>

            <div className="profile-security-status" role="status">
              <ShieldCheck size={16} />
              <div>
                <span>Account status</span>
                <strong>Active • Research access</strong>
              </div>
            </div>
          </section>

          <section className="content-card profile-panel">
            <SectionIntro eyebrow="Research" title="Heart Disease Classification System" detail="Model overview" />

            <p className="profile-research-description">
              AI-based multi-class heart disease classification using clinical patient data, Mutual Information feature selection, PCA feature extraction, and a 1D CNN.
            </p>

            <ul className="profile-research-list" aria-label="Research pipeline details">
              <li><span>Input</span><strong>23 clinical features</strong></li>
              <li><span>MI</span><strong>20 selected features</strong></li>
              <li><span>PCA</span><strong>18 components</strong></li>
              <li><span>Classifier</span><strong>1D CNN</strong></li>
              <li><span>Classes</span><strong>7</strong></li>
            </ul>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
