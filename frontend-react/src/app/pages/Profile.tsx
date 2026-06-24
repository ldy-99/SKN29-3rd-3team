import { useEffect, useState } from "react";
import { PageTitle, ApiBadge, FormGroup, SettingsList, Button, WarningBox } from "../components/UI";
import { Check } from "lucide-react";
import { api } from "../api/client";

export function Profile() {
  const [isSaved, setIsSaved] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getProfile()
      .then((data) => setProfile(data as Record<string, unknown>))
      .catch((error) => setError(error instanceof Error ? error.message : "프로필 조회에 실패했습니다."));
  }, []);

  const saveProfile = async () => {
    setError("");

    try {
      await api.saveProfile(profile ?? {});
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void saveProfile();
  };

  const handlePatch = async () => {
    setError("");

    try {
      await api.patchProfile({
        monthly_household_income_krw: null,
        total_assets_krw: null,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "프로필 일부 수정에 실패했습니다.");
    }
  };

  const inputClass = "w-full bg-[#f5f5f7] border border-transparent rounded-[12px] px-3 py-2 text-[15px] focus:outline-none focus:bg-white focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff] transition-colors appearance-none";

  return (
    <div className="pb-20">
      <ApiBadge method="GET/PUT/PATCH" endpoint="/api/user/profile" />
      
      <PageTitle 
        title="내 청약 조건" 
        description="모르는 항목은 비워둘 수 있어요. 비워둔 값은 진단 결과에서 따로 안내합니다."
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handlePatch} className="shrink-0">
              일부 수정 확인
            </Button>
            <Button type="button" onClick={saveProfile} className="gap-2 shrink-0">
              {isSaved ? <Check className="w-4 h-4" /> : "저장"}
              {isSaved ? "저장됨" : "저장하기"}
            </Button>
          </div>
        }
      />

      {error && (
        <WarningBox type="error" title="API 연결 오류">
          {error}
        </WarningBox>
      )}

      {profile && (
        <div className="mb-6 text-[13px] text-[#6e6e73] bg-[#f5f5f7] p-4 rounded-[16px]">
          fixture 프로필 로드 완료: {String(profile.residence_region)} / {String(profile.bankbook_type)}
        </div>
      )}

      <form className="space-y-10" onSubmit={handleSave}>
        {/* 필수 정보 */}
        <section>
          <div className="mb-3 px-2">
            <h2 className="text-[13px] font-semibold text-[#6e6e73] uppercase tracking-wider">기본 필수 정보</h2>
          </div>
          
          <SettingsList>
            <FormGroup label="청약통장 유형" required>
              <select className={inputClass}>
                <option value="">선택 안 함</option>
                <option value="chungyak_save">주택청약종합저축</option>
                <option value="chungyak_yechi">청약예금</option>
                <option value="chungyak_boogeum">청약부금</option>
              </select>
            </FormGroup>

            <FormGroup label="통장 가입일" required>
              <input type="date" className={inputClass} />
            </FormGroup>

            <FormGroup label="납입 횟수 (회)" required helperText="모르면 비워두세요">
              <input type="number" min="0" placeholder="예: 24" className={inputClass} />
            </FormGroup>

            <FormGroup label="예치금 (만원)" required>
              <input type="number" min="0" placeholder="예: 300" className={inputClass} />
            </FormGroup>

            <FormGroup label="거주 지역" required>
              <select className={inputClass}>
                <option value="">선택 안 함</option>
                <option value="seoul">서울특별시</option>
                <option value="gyeonggi">경기도</option>
                <option value="incheon">인천광역시</option>
              </select>
            </FormGroup>

            <FormGroup label="무주택 여부" required>
              <select className={inputClass}>
                <option value="">선택 안 함</option>
                <option value="true">무주택 (세대원 전원)</option>
                <option value="false">유주택</option>
              </select>
            </FormGroup>

            <FormGroup label="세대주 여부" required>
              <select className={inputClass}>
                <option value="">선택 안 함</option>
                <option value="true">세대주</option>
                <option value="false">세대원</option>
              </select>
            </FormGroup>

            <FormGroup label="세대원 수" required helperText="본인 제외">
              <input type="number" min="0" placeholder="예: 3" className={inputClass} />
            </FormGroup>
          </SettingsList>
        </section>

        {/* 선택 정보 */}
        <section>
          <div className="mb-3 px-2">
            <h2 className="text-[13px] font-semibold text-[#6e6e73] uppercase tracking-wider">추가 선택 정보 (특별공급 용도)</h2>
          </div>
          
          <SettingsList>
            <FormGroup label="거주 기간 (년)">
              <select className={inputClass}>
                <option value="null">모름 / 비워둠</option>
                <option value="1">1년 미만</option>
                <option value="3">1년 이상 3년 미만</option>
                <option value="5">3년 이상</option>
              </select>
            </FormGroup>

            <FormGroup label="무주택 기간 (년)">
              <select className={inputClass}>
                <option value="null">모름 / 비워둠</option>
                <option value="1">1년 미만</option>
                <option value="3">1년 이상 3년 미만</option>
                <option value="5">3년 이상 5년 미만</option>
                <option value="10">5년 이상 10년 미만</option>
                <option value="15">10년 이상 15년 미만</option>
                <option value="20">15년 이상</option>
              </select>
            </FormGroup>

            <FormGroup label="혼인 기간 (년)">
              <select className={inputClass}>
                <option value="null">모름 / 비워둠</option>
                <option value="3">3년 이하</option>
                <option value="5">3년 초과 5년 이하</option>
                <option value="7">5년 초과 7년 이하</option>
                <option value="8">7년 초과</option>
              </select>
            </FormGroup>

            <FormGroup label="맞벌이 여부">
              <div className="flex gap-2 p-1 bg-[#f5f5f7] rounded-[14px]">
                <label className="flex-1 text-center cursor-pointer">
                  <input type="radio" name="dual_income" value="null" defaultChecked className="peer sr-only" />
                  <div className="py-1.5 text-[14px] rounded-[10px] peer-checked:bg-white peer-checked:shadow-sm peer-checked:font-semibold text-[#6e6e73] peer-checked:text-[#1d1d1f] transition-all">모름</div>
                </label>
                <label className="flex-1 text-center cursor-pointer">
                  <input type="radio" name="dual_income" value="true" className="peer sr-only" />
                  <div className="py-1.5 text-[14px] rounded-[10px] peer-checked:bg-white peer-checked:shadow-sm peer-checked:font-semibold text-[#6e6e73] peer-checked:text-[#1d1d1f] transition-all">맞벌이</div>
                </label>
                <label className="flex-1 text-center cursor-pointer">
                  <input type="radio" name="dual_income" value="false" className="peer sr-only" />
                  <div className="py-1.5 text-[14px] rounded-[10px] peer-checked:bg-white peer-checked:shadow-sm peer-checked:font-semibold text-[#6e6e73] peer-checked:text-[#1d1d1f] transition-all">외벌이</div>
                </label>
              </div>
            </FormGroup>

            <FormGroup label="월평균 소득 (만원)">
              <div className="flex gap-2 items-center">
                <input type="number" min="0" placeholder="모르면 비워둠" className={`${inputClass} flex-1`} />
              </div>
            </FormGroup>
          </SettingsList>
        </section>

      </form>
    </div>
  );
}
