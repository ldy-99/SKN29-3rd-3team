from django.contrib.auth import get_user_model

User = get_user_model()

class DummyLoginMiddleware:
    """
    회원가입 및 로그인 기능이 구현되기 전까지 작동하는 임시 미들웨어.
    인증되지 않은 요청에 대해 데이터베이스의 첫 번째 유저(없을 경우 자동 생성)를 
    request.user에 강제 할당하여 로그인된 상태로 취급합니다.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 관리자 페이지(/admin/) 관련 요청은 임시 더미 로그인 적용에서 제외
        if request.path.startswith('/admin/'):
            return self.get_response(request)

        if not request.user.is_authenticated:
            # DB에서 유저를 조회하거나 없을 경우 dummy 유저 자동 생성
            try:
                user = User.objects.first()
                if not user:
                    user, created = User.objects.get_or_create(
                        username="dummy_user",
                        email="dummy@example.com",
                        is_staff=True,
                        is_superuser=True
                    )
                    if created:
                        user.set_password("dummy1234")
                        user.save()
                request.user = user
            except Exception:
                # 데이터베이스 마이그레이션이 되지 않은 초기 단계에서는 예외 무시
                pass
        
        response = self.get_response(request)
        return response
