// 역할: 로그인 사용자의 계정 정보와 Django에 저장된 청약 진단 이력을 조회합니다.
// 흐름: MyPage -> api.getMe/getMyStrategies -> Django /api/auth/me, /api/strategy/me.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/strategy/views.py.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, CalendarDays, History, KeyRound, Mail, MapPin, Settings, Trash2, User, X } from "lucide-react";
import { Button, Card, ErrorNotice, PageTitle, StatusBadge } from "../components/UI";
import { api, CurrentUser, StrategyRecord } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getAnnouncementPresentation, type AnnouncementPresentation } from "../utils/announcementPresentation";

type UnknownRecord = Record<string, unknown>;

type AnnouncementGroup = {
  kind: "announcement";
  key: string;
  title: string;
  location?: string;
  latestCreatedAt: string;
  items: Array<{
    strategy: StrategyRecord;
    announcement: AnnouncementPresentation;
  }>;
};

type ProfileOnlyGroup = {
  key: string;
  latestCreatedAt: string;
  latestStrategy: StrategyRecord;
  tags: string[];
  items: StrategyRecord[];
};

type HistoryEntry = AnnouncementGroup;
type CarouselBookend = {
  kind: "bookend";
  key: string;
};
type CarouselItem = HistoryEntry | CarouselBookend;

export function MyPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const carouselRef = useRef<HTMLDivElement>(null);
  const lastCarouselStepAtRef = useRef(0);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<UnknownRecord | null>(null);
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<AnnouncementGroup | null>(null);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(1);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isBasicDiagnosisRunning, setIsBasicDiagnosisRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const loadMyPage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [currentUser, savedStrategies, currentProfile] = await Promise.all([
        api.getMe(),
        api.getMyStrategies(),
        api.getProfile().catch(() => null),
      ]);
      setUser(currentUser);
      setStrategies(savedStrategies);
      setProfile(asRecord(currentProfile) ?? null);
    } catch (error) {
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyPage();
  }, [loadMyPage]);

  const completedCount = useMemo(
    () => strategies.filter((item) => item.status === "SUCCEEDED").length,
    [strategies],
  );

  const historyEntries = useMemo(() => buildHistoryEntries(strategies), [strategies]);
  const profileOnlyGroups = useMemo(() => buildProfileOnlyGroups(strategies), [strategies]);
  const currentProfileTags = useMemo(
    () => profile ? buildProfileTags(profile) : profileOnlyGroups[0]?.tags ?? [],
    [profile, profileOnlyGroups],
  );
  const carouselItems = useMemo<CarouselItem[]>(
    () => [
      { kind: "bookend", key: "bookend-start" },
      ...historyEntries,
      { kind: "bookend", key: "bookend-end" },
    ],
    [historyEntries],
  );

  useEffect(() => {
    setActiveCarouselIndex((current) => {
      if (carouselItems.length <= 1) return 0;
      return Math.min(Math.max(current, 1), carouselItems.length - 2);
    });
  }, [carouselItems.length]);

  const openResult = (strategyId: string) => {
    setSelectedGroup(null);
    navigate(`/results/${strategyId}`);
  };

  const runBasicDiagnosis = useCallback(async () => {
    if (isBasicDiagnosisRunning) return;

    setIsBasicDiagnosisRunning(true);
    setError(null);

    try {
      const result = await api.runStrategy({
        announcement_text: null,
        profile_only: true,
        input_method: null,
        source_filename: null,
        pdf_analysis_id: null,
        pdf_summary_text: null,
        pdf_extracted_fields: null,
      });
      navigate(`/results/${result.strategy_id}`);
    } catch (error) {
      setError(error);
    } finally {
      setIsBasicDiagnosisRunning(false);
    }
  }, [isBasicDiagnosisRunning, navigate]);

  const stepCarousel = useCallback((direction: -1 | 1) => {
    setActiveCarouselIndex((current) => Math.min(Math.max(current + direction, 1), carouselItems.length - 2));
  }, [carouselItems.length]);

  useEffect(() => {
    const carouselElement = carouselRef.current;
    if (!carouselElement) return;

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (carouselItems.length <= 3) return;

      const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(movement) < 8) return;

      const now = window.performance.now();
      if (now - lastCarouselStepAtRef.current < 360) return;
      lastCarouselStepAtRef.current = now;
      stepCarousel(movement > 0 ? 1 : -1);
    };

    carouselElement.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => carouselElement.removeEventListener("wheel", handleNativeWheel);
  }, [carouselItems.length, stepCarousel]);

  const handleCarouselKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      stepCarousel(-1);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      stepCarousel(1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveCarouselIndex(1);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveCarouselIndex(Math.max(carouselItems.length - 2, 0));
    }
  };

  const handleCarouselSelect = (index: number, item: CarouselItem) => {
    if (item.kind === "bookend") return;
    if (index !== activeCarouselIndex) {
      setActiveCarouselIndex(index);
      return;
    }

    if (item.kind === "announcement") {
      setSelectedGroup(item);
    }
  };

  return (
    <div className="pb-20">
      <style>
        {`
          @keyframes reportCardFlipIn {
            from {
              opacity: 0;
              transform: translateY(36px) scale(0.82) rotateY(-78deg);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1) rotateY(0deg);
            }
          }
        `}
      </style>

      <PageTitle
        title="마이페이지"
        description="내 계정과 저장된 청약 진단 기록을 확인하고 결과를 다시 조회할 수 있습니다."
      />

      <ErrorNotice error={error} fallbackMessage="마이페이지 정보를 불러오지 못했습니다." />

      <AccountOverviewCard
        user={user}
        totalCount={strategies.length}
        completedCount={completedCount}
        isLoading={isLoading}
        onOpenSettings={() => setIsAccountDialogOpen(true)}
      />

      <ProfileSummaryBar
        tags={currentProfileTags}
        latestProfileOnlyGroup={profileOnlyGroups[0]}
        onOpenResult={openResult}
        onEditProfile={() => navigate("/profile")}
        onRunBasic={runBasicDiagnosis}
        isBasicRunning={isBasicDiagnosisRunning}
      />

      <div className="mb-5 flex items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-[22px] font-bold text-[#152846]">청약 진단 기록</h2>
          <p className="mt-1 text-[14px] text-[#69717d]">
            공고 기반 분석은 아파트명 단위로 묶어 확인합니다.
          </p>
        </div>
        <Button onClick={() => navigate("/strategy")}>새 진단</Button>
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-[14px] text-[#6e6e73]">
          저장된 진단 기록을 불러오고 있습니다.
        </Card>
      ) : strategies.length === 0 ? (
        <Card className="p-10 text-center">
          <History className="w-10 h-10 mx-auto mb-4 text-[#a1a1a6]" />
          <h3 className="font-semibold text-[18px] mb-2">저장된 진단이 없습니다</h3>
          <p className="text-[14px] text-[#6e6e73] mb-6">청약 진단을 실행하면 결과가 이곳에 자동 저장됩니다.</p>
          <Button onClick={() => navigate("/strategy")}>첫 진단 시작하기</Button>
        </Card>
      ) : (
        <div className="space-y-10">
          {historyEntries.length > 0 && (
            <ReportCarousel
              carouselRef={carouselRef}
              items={carouselItems}
              activeIndex={activeCarouselIndex}
              onKeyDown={handleCarouselKeyDown}
              onSelect={handleCarouselSelect}
            />
          )}
          {historyEntries.length === 0 && (
            <Card className="p-8 text-center">
              <History className="mx-auto mb-3 h-9 w-9 text-[#a1a1a6]" />
              <h3 className="text-[18px] font-bold text-[#152846]">공고 기반 분석 기록이 없습니다</h3>
              <p className="mt-2 text-[14px] text-[#69717d]">
                PDF 공고문 또는 공고 내용을 넣고 진단하면 이곳에 아파트명 기준 카드가 생성됩니다.
              </p>
            </Card>
          )}
        </div>
      )}

      {selectedGroup && (
        <HistoryDialog
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onOpenResult={openResult}
        />
      )}

      {isAccountDialogOpen && (
        <AccountManagementDialog
          onClose={() => setIsAccountDialogOpen(false)}
          onPasswordChanged={() => void loadMyPage()}
          onAccountDeleted={async () => {
            await refreshUser();
            navigate("/", { replace: true });
          }}
        />
      )}
    </div>
  );
}

function AccountOverviewCard({
  user,
  totalCount,
  completedCount,
  isLoading,
  onOpenSettings,
}: {
  user: CurrentUser | null;
  totalCount: number;
  completedCount: number;
  isLoading: boolean;
  onOpenSettings: () => void;
}) {
  return (
    <Card className="mb-6 !rounded-[26px] !border-[#e3ded5] bg-white/90 p-5 shadow-[0_18px_52px_rgba(24,31,43,0.06)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#102e5a] text-white">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#b86a12]">계정 정보</p>
            <h2 className="mt-1 truncate text-[24px] font-black tracking-[-0.01em] text-[#152846]">
              {user?.username ?? (isLoading ? "계정 확인 중" : "계정 정보 없음")}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#69717d]">
              {user?.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                가입 {user?.date_joined ? formatDateOnly(user.date_joined) : "확인 중"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
          <AccountMiniMetric label="전체 진단" value={`${totalCount}건`} />
          <AccountMiniMetric label="완료 진단" value={`${completedCount}건`} />
          <Button variant="outline" className="col-span-2 gap-2 !rounded-full !border-[#d9dee8] bg-[#f7f8fb] sm:col-span-1" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
            계정 관리
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AccountMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#ece6dc] bg-[#fffefa] px-4 py-3">
      <p className="text-[11px] font-bold text-[#7a818c]">{label}</p>
      <p className="mt-1 text-[18px] font-black text-[#152846]">{value}</p>
    </div>
  );
}

function AccountManagementDialog({
  onClose,
  onPasswordChanged,
  onAccountDeleted,
}: {
  onClose: () => void;
  onPasswordChanged: () => void;
  onAccountDeleted: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isDeleteConfirming) {
      deleteConfirmButtonRef.current?.focus();
    }
  }, [isDeleteConfirming]);

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setFormError(null);
    setIsSubmitting(true);

    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("비밀번호가 변경되었습니다.");
      onPasswordChanged();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "비밀번호 변경에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setMessage(null);
    setFormError(null);
    setIsSubmitting(true);

    try {
      await api.deleteAccount({ password: deletePassword });
      await onAccountDeleted();
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "계정 삭제에 실패했습니다.");
      setIsDeleteConfirming(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-dialog-title"
      onClick={onClose}
      onKeyDown={handleDialogKeyDown}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl overflow-hidden rounded-[26px] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#eceff3] px-6 py-5">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#b86a12]">Account Settings</p>
            <h3 id="account-dialog-title" className="mt-1 text-[22px] font-black text-[#152846]">
              계정 관리
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[#69717d]">
              비밀번호 변경과 계정 삭제는 현재 비밀번호 확인 후 진행됩니다.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f5f7] text-[#4d5562] transition-colors hover:bg-[#e8ebef]"
            onClick={onClose}
            aria-label="계정 관리 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {(message || formError) && (
            <div className={`rounded-[16px] px-4 py-3 text-[13px] font-semibold ${formError ? "bg-[#fff2f1] text-[#9b2f2a]" : "bg-[#f1fbf4] text-[#237a3f]"}`}>
              {formError ?? message}
            </div>
          )}

          <form className="rounded-[20px] border border-[#e6e1d8] bg-[#fffefa] p-5" onSubmit={handlePasswordChange}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#eef4ff] text-[#245ea8]">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-[16px] font-black text-[#152846]">비밀번호 변경</h4>
                <p className="text-[12px] text-[#69717d]">현재 비밀번호와 새 비밀번호를 입력하세요.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] font-bold text-[#69717d]">
                현재 비밀번호
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="mt-1 w-full rounded-[14px] border border-[#ddd7cb] px-3 py-3 text-[14px] text-[#152846] outline-none focus:border-[#245ea8]"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className="text-[12px] font-bold text-[#69717d]">
                새 비밀번호
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-1 w-full rounded-[14px] border border-[#ddd7cb] px-3 py-3 text-[14px] text-[#152846] outline-none focus:border-[#245ea8]"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" variant="outline" disabled={isSubmitting || !currentPassword || !newPassword}>
                변경 저장
              </Button>
            </div>
          </form>

          <div className="rounded-[20px] border border-[#f0d1cd] bg-[#fff8f7] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#ffebe8] text-[#c43b31]">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-[16px] font-black text-[#8f2f2a]">계정 삭제</h4>
                <p className="text-[12px] text-[#8a6864]">삭제하면 저장된 진단 기록과 프로필을 되돌릴 수 없습니다.</p>
              </div>
            </div>

            <label className="text-[12px] font-bold text-[#8a6864]">
              비밀번호 확인
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => {
                  setDeletePassword(event.target.value);
                  setIsDeleteConfirming(false);
                }}
                className="mt-1 w-full rounded-[14px] border border-[#f0d1cd] px-3 py-3 text-[14px] text-[#152846] outline-none focus:border-[#c43b31]"
                autoComplete="current-password"
              />
            </label>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-relaxed text-[#8a6864]">
                삭제 전 비밀번호를 입력한 뒤 최종 확인을 진행해주세요.
              </p>
              <Button
                type="button"
                variant="outline"
                className="!border-[#efb8b1] !text-[#a53a32] hover:!bg-[#fff0ee]"
                disabled={isSubmitting || !deletePassword}
                onClick={() => setIsDeleteConfirming(true)}
              >
                계정 삭제
              </Button>
            </div>
          </div>
        </div>

        {isDeleteConfirming && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onClick={(event) => {
              event.stopPropagation();
              setIsDeleteConfirming(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_28px_80px_rgba(0,0,0,0.28)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#ffebe8] text-[#c43b31]">
                <Trash2 className="h-5 w-5" />
              </div>
              <h4 id="delete-confirm-title" className="text-[22px] font-black text-[#8f2f2a]">
                정말 삭제하시겠습니까?
              </h4>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6f5b58]">
                계정을 삭제하면 프로필과 저장된 진단 기록을 복구할 수 없습니다.
                계속하려면 아래 최종 삭제 버튼을 눌러주세요.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  ref={deleteConfirmButtonRef}
                  type="button"
                  className="inline-flex items-center justify-center rounded-[16px] border border-[#e5e5e7] bg-white px-5 py-3 text-[15px] font-semibold text-[#1d1d1f] transition-all hover:bg-[#f5f5f7] focus:outline-none focus:ring-2 focus:ring-[#e5e5e7] focus:ring-offset-2 active:scale-[0.98]"
                  onClick={() => setIsDeleteConfirming(false)}
                >
                  취소
                </button>
                <Button
                  type="button"
                  variant="outline"
                  className="!border-[#efb8b1] !bg-[#fff8f7] !text-[#a53a32] hover:!bg-[#fff0ee]"
                  disabled={isSubmitting}
                  onClick={() => void handleDeleteAccount()}
                >
                  최종 삭제
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileSummaryBar({
  tags,
  latestProfileOnlyGroup,
  onOpenResult,
  onEditProfile,
  onRunBasic,
  isBasicRunning,
}: {
  tags: string[];
  latestProfileOnlyGroup?: ProfileOnlyGroup;
  onOpenResult: (strategyId: string) => void;
  onEditProfile: () => void;
  onRunBasic: () => void;
  isBasicRunning: boolean;
}) {
  const displayTags = tags.length > 0 ? tags : ["프로필 입력 필요"];
  const needsProfile = tags.length === 0 && !latestProfileOnlyGroup;

  return (
    <Card className="mb-8 !rounded-[24px] !border-[#e5e1d8] bg-white/82 px-5 py-4 shadow-[0_18px_52px_rgba(24,31,43,0.06)] backdrop-blur sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-[20px] font-black tracking-[-0.01em] text-[#152846]">기본 정보 진단</h3>
            <span className="text-[13px] font-semibold text-[#8a8f98]">
              {latestProfileOnlyGroup ? formatDateOnly(latestProfileOnlyGroup.latestCreatedAt) : "현재 기준"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {displayTags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] font-semibold text-[#394150]"
              >
                {tag}
              </span>
            ))}
            {displayTags.length > 4 && (
              <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] font-semibold text-[#8a8f98]">
                +{displayTags.length - 4}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {needsProfile ? (
            <Button variant="outline" className="gap-2 whitespace-nowrap !rounded-full !border-[#d9dee8] bg-[#f7f8fb]" onClick={onEditProfile}>
              프로필 입력
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : latestProfileOnlyGroup ? (
            <Button variant="outline" className="gap-2 whitespace-nowrap !rounded-full !border-[#d9dee8] bg-[#f7f8fb]" onClick={() => onOpenResult(latestProfileOnlyGroup.latestStrategy.strategy_id)}>
              기본 진단
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" className="gap-2 whitespace-nowrap !rounded-full !border-[#d9dee8] bg-[#f7f8fb]" onClick={onRunBasic} disabled={isBasicRunning}>
              {isBasicRunning ? "진단 중..." : "기본 진단"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" className="whitespace-nowrap !rounded-full !border-transparent bg-transparent text-[#5f6875] shadow-none hover:bg-[#f5f5f7]" onClick={onEditProfile}>
            수정
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReportCarousel({
  carouselRef,
  items,
  activeIndex,
  onKeyDown,
  onSelect,
}: {
  carouselRef: RefObject<HTMLDivElement>;
  items: CarouselItem[];
  activeIndex: number;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onSelect: (index: number, item: CarouselItem) => void;
}) {
  const descriptionId = useId();
  const activeItem = items[activeIndex];

  return (
    <>
      <p id={descriptionId} className="sr-only">
        좌우 방향키, PageUp, PageDown, Home, End 키로 카드를 이동하고 Enter 키로 현재 카드를 선택할 수 있습니다.
      </p>
      <div
        ref={carouselRef}
        className="relative h-[430px] overflow-hidden outline-none [overscroll-behavior:contain] focus-visible:ring-4 focus-visible:ring-[#245ea8]/15 sm:h-[470px]"
        role="listbox"
        tabIndex={0}
        aria-label="청약 진단 기록 카드 캐러셀"
        aria-describedby={descriptionId}
        aria-activedescendant={activeItem ? `report-card-${activeItem.key}` : undefined}
        onKeyDown={onKeyDown}
      >
        {items.map((item, index) => {
          const offset = index - activeIndex;
          if (Math.abs(offset) > 1) return null;

          const isActive = offset === 0;
          const positionClass =
            isActive
              ? "z-20 -translate-x-1/2 scale-100 opacity-100"
              : offset < 0
                ? "z-10 -translate-x-[118%] scale-[0.82] -rotate-[7deg] opacity-80"
                : "z-10 translate-x-[18%] scale-[0.82] rotate-[7deg] opacity-80";

          return (
            <button
              id={`report-card-${item.key}`}
              key={item.key}
              type="button"
              role="option"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`absolute left-1/2 top-4 origin-center transition-all duration-500 ease-out ${positionClass}`}
              onClick={() => onSelect(index, item)}
              aria-label={item.kind === "bookend" ? "AFIT 기본 카드" : `${getCarouselTitle(item)} 선택`}
            >
              <CarouselItemCard item={item} isActive={isActive} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function CarouselItemCard({ item, isActive }: { item: CarouselItem; isActive: boolean }) {
  if (item.kind === "bookend") {
    return <AfitCardBack />;
  }

  return <AnnouncementCarouselCard group={item} isActive={isActive} />;
}

function AfitCardBack() {
  return (
    <div className="h-[390px] w-[270px] overflow-hidden rounded-[26px] shadow-[0_18px_38px_rgba(35,45,60,0.18)] sm:h-[430px] sm:w-[300px]">
      <picture>
        <source media="(min-width: 640px)" srcSet="/afit-card-back_300x430.png" />
        <img
          src="/afit-card-back_270x390.png"
          alt=""
          className="h-full w-full object-fill"
          draggable={false}
        />
      </picture>
    </div>
  );
}

function AnnouncementCarouselCard({ group, isActive }: { group: AnnouncementGroup; isActive: boolean }) {
  return (
    <div className="relative h-[390px] w-[270px] overflow-hidden rounded-[26px] border border-[#d8cfc1] bg-[#fbf7ef] px-5 py-6 text-left shadow-[0_18px_38px_rgba(35,45,60,0.14)] sm:h-[430px] sm:w-[300px] sm:px-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full border border-[#e6ddce]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full border border-[#e6ddce]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.65),rgba(255,255,255,0)_48%)]" />

      <div className="relative flex h-full flex-col">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#b86a12]">Report</p>
        <h3 className="mt-5 line-clamp-4 text-[25px] font-black leading-tight text-[#1a2440] break-keep sm:text-[27px]">
          {group.title}
        </h3>

        <div className="mt-auto space-y-3">
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/72 px-3 py-2 text-[13px] font-bold text-[#344258] shadow-[inset_0_0_0_1px_rgba(216,207,193,0.68)]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b86a12]" />
            <span className="truncate">{group.location ? formatCompactLocation(group.location) : "위치 확인 필요"}</span>
          </div>

          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-[15px] bg-white/70 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(216,207,193,0.58)]">
              <dt className="text-[11px] font-semibold text-[#858b94]">레포트 생성</dt>
              <dd className="mt-1 text-[15px] font-black text-[#245ea8]">총 {group.items.length}회</dd>
            </div>
            <div className="rounded-[15px] bg-white/70 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(216,207,193,0.58)]">
              <dt className="text-[11px] font-semibold text-[#858b94]">최근 생성</dt>
              <dd className="mt-1 text-[13px] font-black leading-tight text-[#1a2440]">
                {formatDateTime(group.latestCreatedAt)}
              </dd>
            </div>
          </dl>

          <div className="flex items-center justify-between border-t border-[#e5dccf] pt-3 text-[12px] font-bold text-[#245ea8]">
            <span>{isActive ? "이력 보기" : "가운데로 이동"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function getCarouselTitle(item: HistoryEntry) {
  return item.title;
}

function HistoryDialog({
  group,
  onClose,
  onOpenResult,
}: {
  group: AnnouncementGroup;
  onClose: () => void;
  onOpenResult: (strategyId: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 px-4 py-8 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-dialog-title"
      onClick={onClose}
      onKeyDown={handleDialogKeyDown}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[1040px] [animation:reportCardFlipIn_420ms_cubic-bezier(.2,.8,.2,1)] [perspective:1200px]"
        onClick={(event) => event.stopPropagation()}
      >
        <Card className="relative h-[84vh] max-h-[760px] overflow-hidden !rounded-[26px] !border-white/30 bg-white p-0 shadow-[0_28px_80px_rgba(0,0,0,0.32)]">
          <div className="absolute inset-x-10 top-5 h-32 rounded-[24px] bg-[#102e5a]/10 blur-2xl" />
          <div className="relative grid h-full gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="relative hidden overflow-hidden bg-[#102e5a] p-6 text-white lg:block">
              <div className="absolute -left-20 -top-16 h-64 w-64 rounded-full bg-white/8" />
              <div className="absolute -right-20 bottom-8 h-56 w-56 rounded-full border border-white/12" />

              <div className="relative z-[1] mx-auto mt-12 flex min-h-[360px] max-w-[230px] flex-col justify-between rounded-[24px] border border-[#d8cfc1] bg-[#fbf7ef] px-5 py-6 text-[#152846] shadow-[0_24px_54px_rgba(0,0,0,0.24)]">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#b86a12]">History</p>
                  <h3 className="mt-5 text-[24px] font-black leading-tight break-keep">
                    {group.title}
                  </h3>
                </div>
                <div className="space-y-2">
                  {group.location && (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-[#f6f3ee] px-3 py-1.5 text-[12px] font-bold text-[#344258]">
                      <MapPin className="h-3.5 w-3.5 text-[#b86a12]" />
                      {formatCompactLocation(group.location)}
                    </p>
                  )}
                  <p className="text-[13px] font-bold text-[#245ea8]">총 {group.items.length}회 분석</p>
                  <p className="text-[12px] text-[#69717d]">최근 {formatDateOnly(group.latestCreatedAt)}</p>
                </div>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-col bg-white p-6 sm:p-7">
              <button
                ref={closeButtonRef}
                type="button"
                className="absolute right-4 top-4 rounded-full p-2 text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#152846]"
                onClick={onClose}
                aria-label="분석 이력 닫기"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="shrink-0 pr-10">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#b86a12]">Select Report</p>
                <h4 id="history-dialog-title" className="mt-2 text-[24px] font-bold text-[#152846]">분석 이력 선택</h4>
                <p className="mt-1 text-[14px] text-[#69717d]">
                  같은 공고문으로 생성된 분석 내역을 최근순으로 정리했습니다.
                </p>
              </div>

              <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.items.map(({ strategy }, index) => {
                    const profileChanges = buildProfileChangeBadges(strategy, group.items[index + 1]?.strategy);

                    return (
                      <button
                        key={strategy.strategy_id}
                        type="button"
                        className="min-h-[132px] rounded-[18px] border border-[#e7e2d9] bg-[#fbfaf7] px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#245ea8]/35 hover:bg-[#f8fbff] hover:shadow-[0_12px_28px_rgba(36,94,168,0.10)]"
                        onClick={() => onOpenResult(strategy.strategy_id)}
                      >
                        <div className="flex h-full flex-col justify-between gap-4">
                          <div>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <StatusBadge status={strategy.status} />
                              {index === 0 && (
                                <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-bold text-[#245ea8]">
                                  최근
                                </span>
                              )}
                              {profileChanges.length > 0 && (
                                <span className="rounded-full bg-[#fff1d9] px-2.5 py-1 text-[11px] font-bold text-[#9a5c11]">
                                  조건 변경
                                </span>
                              )}
                            </div>
                            <p className="text-[17px] font-bold text-[#152846]">
                              {formatDateOnly(strategy.created_at)} 분석
                            </p>
                            <p className="mt-1 text-[12px] text-[#69717d]">
                              {formatDateTime(strategy.created_at)}
                            </p>
                            {profileChanges.length > 0 && (
                              <div className="mt-3 space-y-1">
                                {profileChanges.slice(0, 2).map((change) => (
                                  <p key={change} className="text-[11px] leading-5 text-[#8a5b1c]">
                                    변경: {change}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#245ea8]">
                            레포트 보기
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function buildHistoryEntries(strategies: StrategyRecord[]): HistoryEntry[] {
  const groups = new Map<string, AnnouncementGroup>();

  strategies.forEach((strategy) => {
    const announcement = getAnnouncementPresentation(strategy);
    if (!isAnnouncementBased(strategy, announcement)) {
      return;
    }

    const location = getAnnouncementLocation(strategy, announcement);
    const key = `${announcement.title}::${location ?? ""}`;
    const existing = groups.get(key);
    const item = { strategy, announcement };

    if (existing) {
      existing.items.push(item);
      existing.latestCreatedAt = latestDate(existing.latestCreatedAt, strategy.created_at);
      if (!existing.location && location) existing.location = location;
    } else {
      groups.set(key, {
        kind: "announcement",
        key,
        title: announcement.title,
        location,
        latestCreatedAt: strategy.created_at,
        items: [item],
      });
    }
  });

  const groupEntries = Array.from(groups.values()).map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => compareDateDesc(a.strategy.created_at, b.strategy.created_at)),
  }));

  return groupEntries.sort((a, b) => compareDateDesc(a.latestCreatedAt, b.latestCreatedAt));
}

function buildProfileOnlyGroups(strategies: StrategyRecord[]): ProfileOnlyGroup[] {
  const groups = new Map<string, ProfileOnlyGroup>();

  strategies.forEach((strategy) => {
    const announcement = getAnnouncementPresentation(strategy);
    if (isAnnouncementBased(strategy, announcement)) return;

    const profile = asRecord(asRecord(strategy.input_snapshot)?.profile) ?? {};
    const key = buildProfileSnapshotKey(profile);
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(strategy);
      existing.items.sort((a, b) => compareDateDesc(a.created_at, b.created_at));
      existing.latestStrategy = existing.items[0];
      existing.latestCreatedAt = existing.latestStrategy.created_at;
    } else {
      groups.set(key, {
        key,
        latestCreatedAt: strategy.created_at,
        latestStrategy: strategy,
        tags: buildProfileTags(profile),
        items: [strategy],
      });
    }
  });

  return Array.from(groups.values()).sort((a, b) => compareDateDesc(a.latestCreatedAt, b.latestCreatedAt));
}

function isAnnouncementBased(strategy: StrategyRecord, announcement: AnnouncementPresentation) {
  const inputAnnouncement = asRecord(asRecord(strategy.input_snapshot)?.announcement);
  return (
    strategy.diagnosis_mode !== "PROFILE_ONLY" &&
    inputAnnouncement?.profile_only !== true &&
    announcement.title !== "청약 가능성 분석"
  );
}

function getAnnouncementLocation(strategy: StrategyRecord, announcement: AnnouncementPresentation) {
  const inputAnnouncement = asRecord(asRecord(strategy.input_snapshot)?.announcement);
  const pdfFields = asRecord(inputAnnouncement?.pdf_extracted_fields);
  const confirmed = asRecord(strategy.announcement_confirmed);

  return (
    stringValue(pdfFields?.location) ??
    stringValue(confirmed?.region) ??
    announcement.info.find((item) => item.label.includes("지역") || item.label.includes("위치"))?.value
  );
}

function buildProfileSnapshotKey(profile: UnknownRecord) {
  const fields = [
    "residence_region",
    "residence_period_years",
    "is_homeless",
    "homeless_period_years",
    "is_household_head",
    "bankbook_type",
    "bankbook_join_date",
    "bankbook_payment_count",
    "bankbook_balance_krw",
    "savings_amount_krw",
    "marital_status",
    "minor_child_count",
    "household_member_count",
  ];

  return fields.map((field) => `${field}:${String(profile[field] ?? "")}`).join("|");
}

function buildProfileTags(profile: UnknownRecord) {
  const tags = [
    formatRegionTag(stringValue(profile.residence_region)),
    booleanTag(profile.is_homeless, "무주택", "주택 보유"),
    booleanTag(profile.is_household_head, "세대주", "세대원"),
    formatBankbookTag(profile),
  ].filter((tag): tag is string => Boolean(tag));

  return tags.length > 0 ? tags : ["프로필 기준"];
}

function buildProfileChangeBadges(currentStrategy?: StrategyRecord, previousStrategy?: StrategyRecord) {
  const current = getProfileSnapshot(currentStrategy);
  const previous = getProfileSnapshot(previousStrategy);
  if (!current || !previous) return [];

  const comparableFields: Array<{
    key: string;
    label: string;
    format: (value: unknown) => string | undefined;
  }> = [
    { key: "residence_region", label: "거주지", format: (value) => formatRegionTag(stringValue(value)) },
    { key: "is_homeless", label: "주택 상태", format: (value) => booleanTag(value, "무주택", "주택 보유") },
    { key: "homeless_period_years", label: "무주택 기간", format: (value) => formatYears(value) },
    { key: "is_household_head", label: "세대", format: (value) => booleanTag(value, "세대주", "세대원") },
    { key: "bankbook_payment_count", label: "납입 횟수", format: (value) => formatCount(value) },
    { key: "bankbook_balance_krw", label: "예치금", format: (value) => formatCompactWon(value) },
    { key: "savings_amount_krw", label: "저축액", format: (value) => formatCompactWon(value) },
    { key: "minor_child_count", label: "자녀 수", format: (value) => formatCount(value, "명") },
  ];

  return comparableFields
    .map(({ key, label, format }) => {
      const before = format(previous[key]);
      const after = format(current[key]);
      return before && after && before !== after ? `${label} ${before} → ${after}` : undefined;
    })
    .filter((item): item is string => Boolean(item));
}

function getProfileSnapshot(strategy?: StrategyRecord) {
  return asRecord(asRecord(strategy?.input_snapshot)?.profile);
}

function booleanTag(value: unknown, trueText: string, falseText: string) {
  if (value === true) return trueText;
  if (value === false) return falseText;
  return undefined;
}

function formatRegionTag(value?: string) {
  if (!value) return undefined;
  const regionMap: Record<string, string> = {
    SEOUL: "서울",
    GYEONGGI: "경기",
    INCHEON: "인천",
    BUSAN: "부산",
    DAEGU: "대구",
    DAEJEON: "대전",
    GWANGJU: "광주",
    ULSAN: "울산",
    SEJONG: "세종",
    OTHER: "그 외 지역",
  };
  return regionMap[value] ?? value.replace(/_/g, " ");
}

function formatBankbookTag(profile: UnknownRecord) {
  const joinDate = stringValue(profile.bankbook_join_date);
  const paymentCount = numberValue(profile.bankbook_payment_count);
  if (joinDate) {
    const years = Math.max(0, new Date().getFullYear() - new Date(joinDate).getFullYear());
    return years > 0 ? `청약통장 ${years}년` : "청약통장";
  }
  if (paymentCount !== undefined) return `납입 ${paymentCount}회`;
  return undefined;
}

function formatYears(value: unknown) {
  const years = numberValue(value);
  return years !== undefined ? `${years}년` : undefined;
}

function formatCount(value: unknown, unit = "회") {
  const count = numberValue(value);
  return count !== undefined ? `${count}${unit}` : undefined;
}

function formatCompactWon(value: unknown) {
  const amount = numberValue(value);
  if (amount === undefined) return undefined;
  if (amount >= 100000000) {
    return `${(amount / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString("ko-KR")}만원`;
  }
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatCompactLocation(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const match = normalized.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별시|광역시|특별자치시|특별자치도|도)?\s*([가-힣]+구)?/);
  if (match) {
    return [match[1], match[2]].filter(Boolean).join(" ");
  }
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function compareDateDesc(left: string, right: string) {
  return new Date(right).getTime() - new Date(left).getTime();
}

function latestDate(left: string, right: string) {
  return compareDateDesc(left, right) <= 0 ? left : right;
}

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
