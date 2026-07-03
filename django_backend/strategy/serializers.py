"""
역할: 전략 진단, 공고 저장, 챗봇 요청/응답의 공개 API 계약을 검증합니다.
흐름: strategy.views -> serializers -> models/services.
다음 파일: django_backend/strategy/views.py, django_backend/strategy/services.py.
"""
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from strategy.models import AnnouncementInput, StrategyRun

class AnnouncementInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementInput
        fields = [
            'id', 'announcement_text', 'announcement_name', 'region',
            'regulated_area_type', 'supply_category', 'housing_type',
            'sale_price_krw', 'deposit_krw', 'area_text',
            'exclusive_area_sqm', 'supply_household_count',
            'application_start_date', 'application_end_date',
            'special_supply_types_available'
        ]
        read_only_fields = ['id']

    def validate_region(self, value):
        if value is not None and value.strip() == "":
            raise ValidationError("거주 지역(region)은 빈 문자열일 수 없습니다.")
        return value

    def validate_area_text(self, value):
        if value is not None and value.strip() == "":
            raise ValidationError("면적 텍스트(area_text)는 빈 문자열일 수 없습니다.")
        return value

    def validate_supply_category(self, value):
        if value == 'UNKNOWN':
            raise ValidationError("공급 카테고리(supply_category)는 UNKNOWN일 수 없습니다.")
        return value

    def validate_sale_price_krw(self, value):
        if value is not None and (value < 0 or value > 10000000000):
            raise ValidationError("분양가는 0원 이상 100억 원 이하여야 합니다.")
        return value

    def validate_deposit_krw(self, value):
        if value is not None and (value < 0 or value > 10000000000):
            raise ValidationError("보증금은 0원 이상 100억 원 이하여야 합니다.")
        return value

    def validate_exclusive_area_sqm(self, value):
        if value is not None and (value < 1.0 or value > 300.0):
            raise ValidationError("전용면적은 1㎡ 이상 300㎡ 이하여야 합니다.")
        return value

    def validate_supply_household_count(self, value):
        if value is not None and (value < 1 or value > 100000):
            raise ValidationError("공급 세대수는 1세대 이상 100,000세대 이하여야 합니다.")
        return value

    def validate(self, attrs):
        start_date = attrs.get('application_start_date')
        end_date = attrs.get('application_end_date')
        if start_date and end_date and end_date < start_date:
            raise ValidationError({
                "application_end_date": "접수 종료일은 시작일보다 이전일 수 없습니다."
            })
        return attrs


class StrategyRunSerializer(serializers.ModelSerializer):
    strategy_id = serializers.UUIDField(source='id', read_only=True)

    class Meta:
        model = StrategyRun
        fields = ['id', 'strategy_id', 'status', 'input_snapshot', 'result_payload', 'created_at', 'updated_at']
        read_only_fields = ['id', 'strategy_id', 'status', 'input_snapshot', 'result_payload', 'created_at', 'updated_at']

    def to_representation(self, instance):
        # 1. Get original representation fields
        data = super().to_representation(instance)
        
        # 2. Extract inputs and payloads
        input_snapshot = instance.input_snapshot or {}
        announcement_input = input_snapshot.get('announcement', {}) or {}
        result_payload = instance.result_payload or {}
        
        # 3. Determine diagnosis_mode
        is_profile_only = announcement_input.get('profile_only', False)
        if not is_profile_only and not announcement_input.get('announcement_text') and not announcement_input.get('region'):
            is_profile_only = True
            
        diagnosis_mode = "PROFILE_ONLY" if is_profile_only else "ANNOUNCEMENT_BASED"
        data['diagnosis_mode'] = diagnosis_mode
        
        # 4. Map overall_analysis_status
        if instance.status == 'FAILED':
            overall_analysis_status = 'FAILED'
        elif instance.status == 'SUCCEEDED':
            warnings_list = result_payload.get('warnings', [])
            has_missing = False
            for item in result_payload.get('supply_rank', []):
                if item.get('missing_fields'):
                    has_missing = True
                    break
            
            if is_profile_only or warnings_list or has_missing:
                overall_analysis_status = 'PARTIAL'
            else:
                overall_analysis_status = 'COMPLETE'
        else:
            overall_analysis_status = instance.status
            
        data['overall_analysis_status'] = overall_analysis_status
        
        # 5. Map announcement_confirmed
        if diagnosis_mode == 'ANNOUNCEMENT_BASED':
            data['announcement_confirmed'] = {
                "announcement_name": announcement_input.get('announcement_name'),
                "region": announcement_input.get('region'),
                "regulated_area_type": announcement_input.get('regulated_area_type', 'UNKNOWN'),
                "supply_category": announcement_input.get('supply_category'),
                "housing_type": announcement_input.get('housing_type', 'UNKNOWN'),
                "exclusive_area_sqm": announcement_input.get('exclusive_area_sqm'),
                "area_text": announcement_input.get('area_text'),
                "sale_price_krw": announcement_input.get('sale_price_krw'),
                "deposit_krw": announcement_input.get('deposit_krw'),
                "supply_household_count": announcement_input.get('supply_household_count'),
                "application_start_date": announcement_input.get('application_start_date'),
                "application_end_date": announcement_input.get('application_end_date'),
                "special_supply_types_available": announcement_input.get('special_supply_types_available', [])
            }
        else:
            data['announcement_confirmed'] = None
            
        # 6. Map recommended_supply
        recommended_supply = result_payload.get('recommended_supply')
        supply_rank_raw = result_payload.get('supply_rank', [])
        if not recommended_supply and supply_rank_raw:
            first_item = supply_rank_raw[0]
            recommended_supply = first_item.get('type') or first_item.get('supply_type') or first_item.get('name')
        data['recommended_supply'] = recommended_supply
        
        # 7. Map recommended_supply_types (mainly for PROFILE_ONLY)
        recommended_supply_types = []
        for item in supply_rank_raw:
            recommended_supply_types.append({
                "supply_type": item.get('type') or item.get('supply_type') or item.get('name'),
                "status": "PARTIAL" if item.get('missing_fields') else "COMPLETE",
                "missing_fields": item.get('missing_fields', [])
            })
        data['recommended_supply_types'] = recommended_supply_types
        
        # 8. Map supply_rank
        supply_rank = []
        for idx, item in enumerate(supply_rank_raw):
            supply_rank.append({
                "rank": item.get('rank') or (idx + 1),
                "type": item.get('type') or item.get('supply_type') or item.get('name') or f"공급유형 {idx + 1}",
                "chance": item.get('chance') or item.get('status') or (f"{item.get('score')}점" if item.get('score') is not None else "검토"),
                "desc": item.get('reason') or ", ".join(item.get('reasons', [])) or "상세 사유가 포함되지 않았습니다.",
                "missing_fields": item.get('missing_fields', []),
                "source_refs": item.get('source_refs', [])
            })
        data['supply_rank'] = supply_rank
        
        # 9. Map missing_fields_by_supply_type
        missing_fields_by_supply_type = result_payload.get('missing_fields_by_supply_type') or {}
        if not missing_fields_by_supply_type:
            for item in supply_rank_raw:
                stype = item.get('type') or item.get('supply_type') or item.get('name')
                mfields = item.get('missing_fields', [])
                if mfields:
                    missing_fields_by_supply_type[stype] = mfields
        data['missing_fields_by_supply_type'] = missing_fields_by_supply_type
        
        # 10. Map warnings
        data['warnings'] = result_payload.get('warnings', [])
        
        # 11. Map report (clean structure)
        raw_report = result_payload.get('report') or {}
        if not raw_report and 'node6' in result_payload:
            raw_report = result_payload.get('node6', {}).get('final_report', {})
            
        summary = raw_report.get('summary') or raw_report.get('final_summary') or raw_report.get('message') or result_payload.get('message') or ""
        if not summary and instance.status == 'FAILED':
            summary = "진단 중 오류가 발생했습니다."
            
        report = {
            "summary": summary,
            "key_findings": raw_report.get('key_findings') or [],
            "recommendations": raw_report.get('recommendations') or [],
            "warnings": raw_report.get('warnings') or [],
            "missing_fields": raw_report.get('missing_fields') or [],
            "report_type": raw_report.get('report_type') or ("detailed" if diagnosis_mode == 'ANNOUNCEMENT_BASED' else "simple")
        }
        
        # Map finance and strategy details for detailed report
        if report["report_type"] == 'detailed' or 'finance' in raw_report or 'finance' in result_payload:
            finance_data = raw_report.get('finance') or result_payload.get('finance')
            if not finance_data and 'node5' in result_payload:
                node5 = result_payload.get('node5', {})
                loan_result = node5.get('loan_result', {})
                investment_result = node5.get('investment_result', {})
                risk_result = node5.get('risk_result', {})
                finance_data = {
                    "loan_amount": loan_result.get("loan_amount"),
                    "ltv_rate": loan_result.get("ltv_rate"),
                    "area_type": loan_result.get("area_type"),
                    "real_investment": investment_result.get("real_investment"),
                    "price": investment_result.get("price"),
                    "risk_level": risk_result.get("risk_level"),
                    "risk_ratio": risk_result.get("ratio"),
                    "risk_description": risk_result.get("description"),
                }
            report["finance"] = finance_data or {}
            report["strategy"] = raw_report.get('strategy') or result_payload.get('strategy') or ""
            
        data['report'] = report
        
        return data


class StrategyRequestSerializer(serializers.Serializer):
    announcement = AnnouncementInputSerializer(required=False, allow_null=True)
    announcement_text = serializers.CharField(required=False, allow_null=True, allow_blank=True, trim_whitespace=True)
    pdf_analysis_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    input_method = serializers.ChoiceField(choices=["manual", "pdf"], required=False, allow_null=True)
    source_filename = serializers.CharField(required=False, allow_null=True, allow_blank=True, trim_whitespace=True)
    profile_only = serializers.BooleanField(required=False)


class ChatbotRequestSerializer(serializers.Serializer):
    question = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    session_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
