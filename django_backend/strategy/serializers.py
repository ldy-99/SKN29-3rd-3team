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
        data = super().to_representation(instance)
        result_payload = data.get('result_payload')
        if isinstance(result_payload, dict):
            for key, value in result_payload.items():
                data.setdefault(key, value)
        return data


class StrategyRequestSerializer(serializers.Serializer):
    announcement = AnnouncementInputSerializer(required=False, allow_null=True)
    announcement_text = serializers.CharField(required=False, allow_null=True, allow_blank=True, trim_whitespace=True)
    pdf_analysis_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    profile_only = serializers.BooleanField(required=False)


class ChatbotRequestSerializer(serializers.Serializer):
    question = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    session_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
