"""
역할: 4차 Django 공개 프로필 필드를 3차 FastAPI/LangGraph 입력 스키마로 변환합니다.
흐름: StrategyRunAPIView -> ProfileAdapter.to_3rd_spec -> FastAPIClient.send_profile.
주의: React는 3차 내부 필드명을 알지 않고, 변환 책임은 이 파일에 둡니다.
"""
from datetime import date

# React의 거주지역 select는 영문 코드(SEOUL, GYEONGGI...)를 값으로 쓰는데,
# 3차(FastAPI) 엔진은 region을 자연어 지역명으로 취급한다(지역 우선공급 텍스트 매칭,
# LLM 프롬프트 등). 코드가 그대로 넘어가면 "GYEONGGI"가 결과 문구에 그대로 노출되고,
# rag_tools.check_regional_priority의 "user_region.split()[0] in announcement_region"
# 매칭도 항상 실패해 지역 일치 여부가 늘 "불일치"로 잘못 판정된다. 그래서 반드시 여기서
# 한글 지역명으로 변환해서 3차로 넘긴다.
REGION_LABELS = {
    'SEOUL': '서울특별시',
    'GYEONGGI': '경기도',
    'INCHEON': '인천광역시',
    'BUSAN': '부산광역시',
    'DAEGU': '대구광역시',
    'DAEJEON': '대전광역시',
    'GWANGJU': '광주광역시',
    'ULSAN': '울산광역시',
    'SEJONG': '세종특별자치시',
    'OTHER': '기타 지역',
}


class ProfileAdapter:
    @staticmethod
    def to_3rd_spec(profile_4th: dict) -> dict:
        """
        4차 규격의 프로필 딕셔너리를 3차 스펙의 FastAPI가 수용하는 ProfileInput 형태로 변환합니다.
        """
        result = {}

        # 1. 통장 정보
        result['bankbook_type'] = profile_4th.get('bankbook_type')
        join_date_val = profile_4th.get('bankbook_join_date')
        result['bankbook_join_date'] = str(join_date_val) if join_date_val else None

        # 가입 개월 수 계산
        if join_date_val:
            if isinstance(join_date_val, str):
                try:
                    join_dt = date.fromisoformat(join_date_val)
                except ValueError:
                    join_dt = None
            else:
                join_dt = join_date_val

            if join_dt:
                today = date.today()
                joined_months = (today.year - join_dt.year) * 12 + today.month - join_dt.month
                result['bankbook_joined_months'] = max(0, joined_months)
            else:
                result['bankbook_joined_months'] = 0
        else:
            result['bankbook_joined_months'] = 0

        result['bankbook_payments'] = profile_4th.get('bankbook_payment_count', 0)
        result['bankbook_balance'] = profile_4th.get('bankbook_balance_krw', 0)
        # 저축액(누적 납입인정액)은 예치금과 다른 개념이라 별도 필드로 전달한다.
        # 값이 없는 기존 프로필은 None으로 넘겨 3차 계산기가 예치금으로 대체 판정하도록 둔다.
        result['bankbook_savings_amount'] = profile_4th.get('savings_amount_krw')

        # 2. 주택/세대 정보
        residence_region = profile_4th.get('residence_region')
        result['region'] = REGION_LABELS.get(residence_region, residence_region)
        result['residence_period_years'] = profile_4th.get('residence_period_years')

        is_homeless = profile_4th.get('is_homeless', True)
        result['is_homeless'] = is_homeless
        # 주택 소유 현황 (무주택 여부의 반대)
        result['housing_ownership'] = not is_homeless
        result['homeless_period_years'] = profile_4th.get('homeless_period_years') or 0
        result['is_household_head'] = profile_4th.get('is_household_head', False)
        result['num_household_members'] = profile_4th.get('household_member_count', 1)

        # 3. 혼인/자녀 정보
        result['marital_status'] = profile_4th.get('marital_status')
        result['marriage_period_years'] = profile_4th.get('marriage_period_years')
        result['birth_year'] = profile_4th.get('birth_year')

        minor_child_count = profile_4th.get('minor_child_count') or 0
        result['minor_child_count'] = minor_child_count

        # 자녀 여부 및 자녀 수 카테고리 파생
        if minor_child_count > 0:
            result['child_status'] = "HAS_CHILD"
            result['child_count_group'] = "TWO_OR_MORE" if minor_child_count >= 2 else "ONE"
        else:
            result['child_status'] = "NO_CHILD"
            result['child_count_group'] = "NONE"

        result['youngest_child_age_group'] = profile_4th.get('youngest_child_age_group') or "ADULT_OR_NONE"

        # 4. 노부모 부양
        elderly_support_status = profile_4th.get('elderly_support_status')
        if elderly_support_status == 'MEETS_65_AND_3Y':
            result['is_elderly_parent'] = True
            result['elderly_parent_years'] = 3
        else:
            result['is_elderly_parent'] = False
            result['elderly_parent_years'] = 0

        # 5. 소득 및 자산
        result['is_dual_income'] = profile_4th.get('is_dual_income')
        result['average_monthly_income'] = profile_4th.get('monthly_household_income_krw') or 0
        result['has_property_history'] = profile_4th.get('has_household_property_ownership_history', False)
        result['total_assets'] = profile_4th.get('total_assets_krw') or 0

        return result
