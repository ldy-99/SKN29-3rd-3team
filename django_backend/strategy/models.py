from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()

class AnnouncementInput(models.Model):
    """
    수동 입력 또는 PDF 분석을 통해 들어온 청약 공고문 입력 데이터 모델
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcement_inputs')
    
    announcement_text = models.TextField(null=True, blank=True)
    announcement_name = models.CharField(max_length=255, null=True, blank=True)
    region = models.CharField(max_length=50) # 공고 기반 진단 시 필수
    regulated_area_type = models.CharField(max_length=50, default='UNKNOWN')
    supply_category = models.CharField(max_length=50)
    housing_type = models.CharField(max_length=50, default='UNKNOWN')
    sale_price_krw = models.BigIntegerField(null=True, blank=True)
    deposit_krw = models.BigIntegerField(null=True, blank=True)
    area_text = models.CharField(max_length=100)
    exclusive_area_sqm = models.FloatField(null=True, blank=True)
    supply_household_count = models.IntegerField(null=True, blank=True)
    application_start_date = models.DateField(null=True, blank=True)
    application_end_date = models.DateField(null=True, blank=True)
    special_supply_types_available = models.JSONField(null=True, blank=True) # SpecialSupplyType[] 저장

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.announcement_name or f"Announcement {self.id}"


class StrategyRun(models.Model):
    """
    청약 자가진단 실행 이력을 기록하는 모델
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='strategy_runs')
    
    status = models.CharField(max_length=20, default='PENDING') # PENDING, RUNNING, SUCCEEDED, FAILED
    
    # 당시 입력 조건 스냅샷 (프로필 + 공고 입력 정보)
    input_snapshot = models.JSONField(null=True, blank=True)
    # 계산 결과 페이로드 (FastAPI 반환 리포트)
    result_payload = models.JSONField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def transition_to(self, new_status, save=True):
        """
        자가진단 실행 상태를 안전하게 검증하고 전이합니다.
        """
        valid_transitions = {
            'PENDING': {'RUNNING', 'FAILED'},
            'RUNNING': {'SUCCEEDED', 'FAILED'},
            'SUCCEEDED': set(),
            'FAILED': set(),
        }
        if self.status != new_status and new_status not in valid_transitions.get(self.status, set()):
            raise ValueError(f"Cannot transition status from '{self.status}' to '{new_status}'")
        self.status = new_status
        if save:
            self.save(update_fields=['status', 'updated_at'])

    def __str__(self):
        return f"StrategyRun {self.id} ({self.status})"
