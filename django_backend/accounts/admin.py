from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from accounts.models import User, Profile

# 커스텀 User 모델 등록 (UserAdmin을 상속받아 등록하는 것이 안전하고 관리 항목이 보기 좋습니다)
admin.site.register(User, UserAdmin)

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    # 관리자 목록 화면에서 보여줄 컬럼 필드 설정
    list_display = ('user', 'bankbook_type', 'residence_region', 'marital_status', 'created_at')
    # 필터 기능 제공
    list_filter = ('bankbook_type', 'residence_region', 'marital_status')
    # 검색창 기능 제공
    search_fields = ('user__username', 'residence_region')

