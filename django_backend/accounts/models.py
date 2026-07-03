"""
역할: Django 사용자와 청약 자가진단 프로필을 저장하는 모델입니다.
흐름: accounts.serializers -> accounts.models.Profile -> strategy ProfileAdapter.
다음 파일: django_backend/accounts/serializers.py, django_backend/strategy/adapters.py.
"""
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """
    커스텀 User 모델.
    추후 회원가입 및 로그인 도입 시 확장이 가능하도록 AbstractUser를 상속받아 정의합니다.
    """
    pass

class Profile(models.Model):
    """
    청약 자가진단을 위한 12가지 주요 사용자 프로필 정보를 관리하는 모델.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')

    # 1. 청약통장 종류 (Enum)
    bankbook_type = models.CharField(max_length=50, null=True, blank=True)
    # 2. 청약통장 가입일
    bankbook_join_date = models.DateField(null=True, blank=True)
    # 3. 청약통장 납입 횟수
    bankbook_payment_count = models.IntegerField(null=True, blank=True)
    # 4. 청약통장 잔액 (원화)
    bankbook_balance_krw = models.BigIntegerField(null=True, blank=True)

    # 5. 거주 지역
    residence_region = models.CharField(max_length=50, null=True, blank=True)
    # 6. 무주택 여부
    is_homeless = models.BooleanField(null=True, blank=True)
    # 7. 세대주 여부
    is_household_head = models.BooleanField(null=True, blank=True)
    # 8. 부양가족 수 (세대원 수)
    household_member_count = models.IntegerField(null=True, blank=True)

    # 9. 출생 연도
    birth_year = models.IntegerField(null=True, blank=True)
    # 10. 혼인 상태 (Enum)
    marital_status = models.CharField(max_length=50, null=True, blank=True)
    # 11. 미성년 자녀 수
    minor_child_count = models.IntegerField(null=True, blank=True)
    # 12. 세대원 주택 소유 이력 여부
    has_household_property_ownership_history = models.BooleanField(null=True, blank=True)

    # 13. 맞벌이 여부 (조건부 필수/null 허용)
    is_dual_income = models.BooleanField(null=True, blank=True)

    # 4차 계약의 조건부/추가 진단 필드. 비워둔 값은 null로 보존합니다.
    residence_period_years = models.IntegerField(null=True, blank=True)
    homeless_period_years = models.IntegerField(null=True, blank=True)
    marriage_period_years = models.IntegerField(null=True, blank=True)
    monthly_household_income_krw = models.BigIntegerField(null=True, blank=True)
    total_assets_krw = models.BigIntegerField(null=True, blank=True)
    dependent_family_count = models.IntegerField(null=True, blank=True)
    young_child_count = models.IntegerField(null=True, blank=True)
    youngest_child_age_group = models.CharField(max_length=50, null=True, blank=True)
    has_income_tax_5_years = models.BooleanField(null=True, blank=True)
    elderly_support_status = models.CharField(max_length=50, null=True, blank=True)
    elderly_dependent_is_homeless = models.BooleanField(null=True, blank=True)
    real_estate_assets_krw = models.BigIntegerField(null=True, blank=True)
    vehicle_value_krw = models.BigIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"
