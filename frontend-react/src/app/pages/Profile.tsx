// 역할: 청약 자가진단에 필요한 사용자 프로필을 입력/수정하는 화면입니다.
// 흐름: Profile.tsx -> api.getProfile/saveProfile -> Django ProfileAPIView -> accounts.models.Profile.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/accounts/serializers.py.
import { useEffect, useState } from "react";
import { PageTitle, FormGroup, SettingsList, Button, ErrorNotice, WarningBox } from "../components/UI";
import { Check, LoaderCircle } from "lucide-react";
import { ApiRequestError, api } from "../api/client";

type ProfileForm = {
  bankbook_type: string | null;
  bankbook_join_date: string | null;
  bankbook_payment_count: number | null;
  bankbook_balance_krw: number | null;
  residence_region: string | null;
  is_homeless: boolean | null;
  is_household_head: boolean | null;
  household_member_count: number | null;
  birth_year: number | null;
  marital_status: string | null;
  minor_child_count: number | null;
  has_household_property_ownership_history: boolean | null;
  is_dual_income: boolean | null;
  residence_period_years: number | null;
  homeless_period_years: number | null;
  marriage_period_years: number | null;
  monthly_household_income_krw: number | null;
  total_assets_krw: number | null;
  dependent_family_count: number | null;
  young_child_count: number | null;
  youngest_child_age_group: string | null;
  has_income_tax_5_years: boolean | null;
  elderly_support_status: string | null;
  elderly_dependent_is_homeless: boolean | null;
  real_estate_assets_krw: number | null;
  vehicle_value_krw: number | null;
};

const defaultProfile: ProfileForm = {
  bankbook_type: null,
  bankbook_join_date: null,
  bankbook_payment_count: null,
  bankbook_balance_krw: null,
  residence_region: null,
  is_homeless: null,
  is_household_head: null,
  household_member_count: null,
  birth_year: null,
  marital_status: null,
  minor_child_count: null,
  has_household_property_ownership_history: null,
  is_dual_income: null,
  residence_period_years: null,
  homeless_period_years: null,
  marriage_period_years: null,
  monthly_household_income_krw: null,
  total_assets_krw: null,
  dependent_family_count: null,
  young_child_count: null,
  youngest_child_age_group: null,
  has_income_tax_5_years: null,
  elderly_support_status: null,
  elderly_dependent_is_homeless: null,
  real_estate_assets_krw: null,
  vehicle_value_krw: null,
};

const numberFields = new Set<keyof ProfileForm>([
  "bankbook_payment_count",
  "bankbook_balance_krw",
  "household_member_count",
  "birth_year",
  "minor_child_count",
  "residence_period_years",
  "homeless_period_years",
  "marriage_period_years",
  "monthly_household_income_krw",
  "total_assets_krw",
  "dependent_family_count",
  "young_child_count",
  "real_estate_assets_krw",
  "vehicle_value_krw",
]);

const booleanFields = new Set<keyof ProfileForm>([
  "is_homeless",
  "is_household_head",
  "has_household_property_ownership_history",
  "is_dual_income",
  "has_income_tax_5_years",
  "elderly_dependent_is_homeless",
]);

export function Profile() {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileForm>(defaultProfile);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api.getProfile()
      .then((data) => {
        setProfile(normalizeProfile(data as Record<string, unknown>));
        setNotice("저장된 프로필을 불러왔습니다.");
      })
      .catch((error) => {
        setProfile(defaultProfile);
        if (error instanceof ApiRequestError && error.status === 404) {
          setNotice("저장된 프로필이 없어 새로 작성합니다.");
          setError(null);
          return;
        }
        setNotice("");
        setError(error);
      });
  }, []);

  const saveProfile = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setIsSaved(false);
    setError(null);
    setNotice("");

    try {
      const savedProfile = await api.saveProfile(profile);
      setProfile(normalizeProfile(savedProfile));
      setIsSaved(true);
      setNotice("프로필이 저장되었습니다.");
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      setError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void saveProfile();
  };

  const updateField = (field: keyof ProfileForm, value: string) => {
    const parsedValue = parseFieldValue(field, value);

    setProfile((current) => {
      const next = {
        ...current,
        [field]: parsedValue,
      };

      if (field === "residence_region" && !parsedValue) {
        next.residence_period_years = null;
      }
      if (field === "is_homeless" && parsedValue !== true) {
        next.homeless_period_years = null;
      }
      if (field === "marital_status" && parsedValue !== "MARRIED") {
        next.marriage_period_years = null;
        next.is_dual_income = null;
      }
      if (
        field === "household_member_count" &&
        (typeof parsedValue !== "number" || parsedValue <= 1)
      ) {
        next.dependent_family_count = null;
      }
      if (
        field === "minor_child_count" &&
        (typeof parsedValue !== "number" || parsedValue <= 0)
      ) {
        next.young_child_count = null;
        next.youngest_child_age_group = null;
      }
      if (
        field === "elderly_support_status" &&
        parsedValue !== "MEETS_65_AND_3Y"
      ) {
        next.elderly_dependent_is_homeless = null;
      }

      return next;
    });
  };

  const inputClass = "w-full bg-[#f5f5f7] border border-transparent rounded-[12px] px-3 py-2 text-[15px] focus:outline-none focus:bg-white focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff] transition-colors appearance-none";
  const showResidencePeriod = Boolean(profile.residence_region);
  const showHomelessPeriod = profile.is_homeless === true;
  const showMarriageDetails = profile.marital_status === "MARRIED";
  const showDependentFamily = (profile.household_member_count ?? 0) > 1;
  const showChildDetails = (profile.minor_child_count ?? 0) > 0;
  const showElderlyHomeless =
    profile.elderly_support_status === "MEETS_65_AND_3Y";
  const showConditionalDetails =
    showResidencePeriod ||
    showHomelessPeriod ||
    showMarriageDetails ||
    showDependentFamily ||
    showChildDetails;

  return (
    <div className="pb-20">
      <PageTitle
        title="내 청약 조건"
        description="모르는 항목은 비워둘 수 있어요. 비워둔 값은 진단 결과에서 따로 안내합니다."
        action={
          <Button type="button" onClick={saveProfile} disabled={isSaving} className="gap-2 shrink-0">
            {isSaving && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {!isSaving && isSaved && <Check className="w-4 h-4" />}
            {isSaving ? "저장 중" : isSaved ? "저장됨" : "저장하기"}
          </Button>
        }
      />

      <ErrorNotice error={error} fallbackMessage="프로필 요청을 처리하지 못했습니다." />

      {notice && !error && (
        <WarningBox type="success" title="프로필 상태">
          {notice}
        </WarningBox>
      )}

      <form className="space-y-10" onSubmit={handleSave}>
        <section>
          <div className="mb-3 px-2">
            <h2 className="text-[13px] font-semibold text-[#6e6e73] uppercase tracking-wider">기본 필수 정보</h2>
          </div>

          <SettingsList>
            <FormGroup label="청약통장 유형" required>
              <select className={inputClass} value={selectValue(profile.bankbook_type)} onChange={(e) => updateField("bankbook_type", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="HOUSING_SUBSCRIPTION_COMPREHENSIVE">주택청약종합저축</option>
                <option value="SUBSCRIPTION_SAVINGS">청약저축</option>
                <option value="SUBSCRIPTION_DEPOSIT">청약예금</option>
                <option value="SUBSCRIPTION_INSTALLMENT">청약부금</option>
                <option value="UNKNOWN">모름</option>
              </select>
            </FormGroup>

            <FormGroup label="통장 가입일" required>
              <input type="date" className={inputClass} value={selectValue(profile.bankbook_join_date)} onChange={(e) => updateField("bankbook_join_date", e.target.value)} />
            </FormGroup>

            <FormGroup label="납입 횟수 (회)" required>
              <input type="number" min="0" placeholder="예: 24" className={inputClass} value={numberInputValue(profile.bankbook_payment_count)} onChange={(e) => updateField("bankbook_payment_count", e.target.value)} />
            </FormGroup>

            <FormGroup label="예치금 (원)" required helperText="만원 단위가 아니라 원 단위로 저장됩니다.">
              <CurrencyInput
                value={profile.bankbook_balance_krw}
                onChange={(value) => updateField("bankbook_balance_krw", value)}
                placeholder="예: 2,400,000"
                className={inputClass}
              />
            </FormGroup>

            <FormGroup label="거주 지역" required>
              <select className={inputClass} value={selectValue(profile.residence_region)} onChange={(e) => updateField("residence_region", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="SEOUL">서울특별시</option>
                <option value="GYEONGGI">경기도</option>
                <option value="INCHEON">인천광역시</option>
                <option value="BUSAN">부산광역시</option>
                <option value="DAEGU">대구광역시</option>
                <option value="DAEJEON">대전광역시</option>
                <option value="GWANGJU">광주광역시</option>
                <option value="ULSAN">울산광역시</option>
                <option value="SEJONG">세종특별자치시</option>
                <option value="OTHER">그 외 지역</option>
              </select>
            </FormGroup>

            <FormGroup label="무주택 여부" required>
              <select className={inputClass} value={booleanSelectValue(profile.is_homeless)} onChange={(e) => updateField("is_homeless", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="true">무주택</option>
                <option value="false">유주택</option>
              </select>
            </FormGroup>

            <FormGroup label="세대주 여부" required>
              <select className={inputClass} value={booleanSelectValue(profile.is_household_head)} onChange={(e) => updateField("is_household_head", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="true">세대주</option>
                <option value="false">세대원</option>
              </select>
            </FormGroup>

            <FormGroup label="세대원 수" required helperText="본인 포함 1명 이상입니다.">
              <input type="number" min="1" placeholder="예: 2" className={inputClass} value={numberInputValue(profile.household_member_count)} onChange={(e) => updateField("household_member_count", e.target.value)} />
            </FormGroup>

            <FormGroup label="출생 연도" required>
              <input type="number" min="1900" max={new Date().getFullYear()} placeholder="예: 1995" className={inputClass} value={numberInputValue(profile.birth_year)} onChange={(e) => updateField("birth_year", e.target.value)} />
            </FormGroup>

            <FormGroup label="혼인 상태" required>
              <select className={inputClass} value={minimalMaritalStatusValue(profile.marital_status)} onChange={(e) => updateField("marital_status", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="SINGLE">미혼</option>
                <option value="MARRIED">기혼</option>
                <option value="UNKNOWN">기타</option>
              </select>
            </FormGroup>

            <FormGroup label="미성년 자녀 수" required>
              <input type="number" min="0" placeholder="예: 0" className={inputClass} value={numberInputValue(profile.minor_child_count)} onChange={(e) => updateField("minor_child_count", e.target.value)} />
            </FormGroup>

            <FormGroup label="세대 주택 소유 이력" required>
              <select className={inputClass} value={booleanSelectValue(profile.has_household_property_ownership_history)} onChange={(e) => updateField("has_household_property_ownership_history", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="true">있음</option>
                <option value="false">없음</option>
              </select>
            </FormGroup>
          </SettingsList>
        </section>

        {showConditionalDetails && (
          <section>
            <div className="mb-3 px-2">
              <h2 className="text-[13px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                입력 조건에 따른 추가 정보
              </h2>
              <p className="mt-1 text-[13px] text-[#7b828d]">
                위에서 선택한 항목과 관련된 정보만 표시됩니다.
              </p>
            </div>

            <SettingsList>
              {showResidencePeriod && (
                <FormGroup label="현재 지역 거주 기간 (년)">
                  <input type="number" min="0" placeholder="모르면 비워둠" className={inputClass} value={numberInputValue(profile.residence_period_years)} onChange={(e) => updateField("residence_period_years", e.target.value)} />
                </FormGroup>
              )}

              {showHomelessPeriod && (
                <FormGroup label="무주택 기간 (년)">
                  <input type="number" min="0" placeholder="모르면 비워둠" className={inputClass} value={numberInputValue(profile.homeless_period_years)} onChange={(e) => updateField("homeless_period_years", e.target.value)} />
                </FormGroup>
              )}

              {showMarriageDetails && (
                <>
                  <FormGroup label="혼인 기간 (년)">
                    <input type="number" min="0" placeholder="모르면 비워둠" className={inputClass} value={numberInputValue(profile.marriage_period_years)} onChange={(e) => updateField("marriage_period_years", e.target.value)} />
                  </FormGroup>
                  <FormGroup label="맞벌이 여부" required helperText="기혼인 경우 필수 입력입니다.">
                    <select required className={inputClass} value={booleanSelectValue(profile.is_dual_income)} onChange={(e) => updateField("is_dual_income", e.target.value)}>
                      <option value="">선택 안 함</option>
                      <option value="true">맞벌이</option>
                      <option value="false">외벌이</option>
                    </select>
                  </FormGroup>
                </>
              )}

              {showDependentFamily && (
                <FormGroup label="부양가족 수">
                  <input type="number" min="0" placeholder="모르면 비워둠" className={inputClass} value={numberInputValue(profile.dependent_family_count)} onChange={(e) => updateField("dependent_family_count", e.target.value)} />
                </FormGroup>
              )}

              {showChildDetails && (
                <>
                  <FormGroup label="영유아 자녀 수">
                    <input type="number" min="0" max={profile.minor_child_count ?? undefined} placeholder="모르면 비워둠" className={inputClass} value={numberInputValue(profile.young_child_count)} onChange={(e) => updateField("young_child_count", e.target.value)} />
                  </FormGroup>
                  <FormGroup label="가장 어린 자녀 연령대">
                    <select className={inputClass} value={selectValue(profile.youngest_child_age_group)} onChange={(e) => updateField("youngest_child_age_group", e.target.value)}>
                      <option value="">선택 안 함</option>
                      <option value="UNDER_2">2세 미만</option>
                      <option value="AGE_2_TO_6">2세 이상 6세 이하</option>
                      <option value="AGE_7_TO_18">7세 이상 18세 이하</option>
                      <option value="UNKNOWN">모름</option>
                    </select>
                  </FormGroup>
                </>
              )}
            </SettingsList>
          </section>
        )}

        <section>
          <div className="mb-3 px-2">
            <h2 className="text-[13px] font-semibold text-[#6e6e73] uppercase tracking-wider">
              재정 및 기타 선택 정보
            </h2>
          </div>

          <SettingsList>
            <FormGroup label="월평균 가구소득 (원)">
              <CurrencyInput value={profile.monthly_household_income_krw} onChange={(value) => updateField("monthly_household_income_krw", value)} placeholder="모르면 비워둠" className={inputClass} />
            </FormGroup>

            <FormGroup label="총자산 (원)">
              <CurrencyInput value={profile.total_assets_krw} onChange={(value) => updateField("total_assets_krw", value)} placeholder="모르면 비워둠" className={inputClass} />
            </FormGroup>

            <FormGroup label="최근 5년 소득세 납부 이력">
              <select className={inputClass} value={booleanSelectValue(profile.has_income_tax_5_years)} onChange={(e) => updateField("has_income_tax_5_years", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="true">있음</option>
                <option value="false">없음</option>
              </select>
            </FormGroup>

            <FormGroup label="노부모 부양 상태">
              <select className={inputClass} value={selectValue(profile.elderly_support_status)} onChange={(e) => updateField("elderly_support_status", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="MEETS_65_AND_3Y">만 65세 이상 3년 이상 부양</option>
                <option value="DOES_NOT_MEET">요건 미충족</option>
                <option value="UNKNOWN">모름</option>
              </select>
            </FormGroup>

            {showElderlyHomeless && (
              <FormGroup label="부양 노부모 무주택 여부">
                <select className={inputClass} value={booleanSelectValue(profile.elderly_dependent_is_homeless)} onChange={(e) => updateField("elderly_dependent_is_homeless", e.target.value)}>
                  <option value="">선택 안 함</option>
                  <option value="true">무주택</option>
                  <option value="false">유주택</option>
                </select>
              </FormGroup>
            )}

            <FormGroup label="부동산 자산 (원)">
              <CurrencyInput value={profile.real_estate_assets_krw} onChange={(value) => updateField("real_estate_assets_krw", value)} placeholder="모르면 비워둠" className={inputClass} />
            </FormGroup>

            <FormGroup label="차량 가액 (원)">
              <CurrencyInput value={profile.vehicle_value_krw} onChange={(value) => updateField("vehicle_value_krw", value)} placeholder="모르면 비워둠" className={inputClass} />
            </FormGroup>
          </SettingsList>
        </section>

        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-[18px] border border-[#dfe4eb] bg-white/95 p-4 shadow-[0_12px_35px_rgba(35,45,60,0.12)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="min-h-5 text-[13px]" aria-live="polite">
            {isSaving && <span className="text-[#566171]">입력한 청약 조건을 저장하고 있습니다.</span>}
            {!isSaving && isSaved && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#16823b]">
                <Check className="h-4 w-4" />
                저장이 완료되었습니다.
              </span>
            )}
            {!isSaving && error && (
              <span className="font-semibold text-[#c62f2f]">
                {error instanceof Error ? error.message : "저장하지 못했습니다. 입력값과 서버 연결을 확인해주세요."}
              </span>
            )}
            {!isSaving && !isSaved && !error && (
              <span className="text-[#747c87]">변경한 내용은 저장해야 진단에 반영됩니다.</span>
            )}
          </div>
          <Button type="submit" disabled={isSaving} className="min-w-[160px] gap-2">
            {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {!isSaving && isSaved && <Check className="h-4 w-4" />}
            {isSaving ? "저장 중" : isSaved ? "저장됨" : "저장하기"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function normalizeProfile(data: Record<string, unknown>): ProfileForm {
  const normalized = { ...defaultProfile };

  for (const key of Object.keys(defaultProfile) as Array<keyof ProfileForm>) {
    if (!(key in data)) continue;
    const value = data[key];
    if (value === undefined) continue;
    normalized[key] = normalizeFieldValue(key, value) as never;
  }

  return normalized;
}

function normalizeFieldValue(field: keyof ProfileForm, value: unknown) {
  if (value === "" || value === undefined) return null;
  if (numberFields.has(field)) {
    return typeof value === "number" && Number.isFinite(value) ? value : Number(value);
  }
  if (booleanFields.has(field)) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }
  return typeof value === "string" ? value : null;
}

function parseFieldValue(field: keyof ProfileForm, value: string) {
  if (value === "") return null;
  if (numberFields.has(field)) return Number(value);
  if (booleanFields.has(field)) return value === "true";
  return value;
}

function selectValue(value: string | null) {
  return value ?? "";
}

function minimalMaritalStatusValue(value: string | null) {
  if (!value) return "";
  if (value === "SINGLE" || value === "MARRIED") return value;
  return "UNKNOWN";
}

function booleanSelectValue(value: boolean | null) {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function numberInputValue(value: number | null) {
  return value ?? "";
}

function CurrencyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className={className}
      value={value === null ? "" : value.toLocaleString("ko-KR")}
      onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
      aria-label="원 단위 금액"
    />
  );
}
