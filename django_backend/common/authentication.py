from rest_framework.authentication import SessionAuthentication

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    개발 및 테스트 시 로컬 API 호출이나 외부 스크립트에서 
    CSRF 토큰 누락으로 인한 403 에러를 방지하기 위해 CSRF 검증을 생략하는 커스텀 세션 인증 클래스입니다.
    """
    def enforce_csrf(self, request):
        # CSRF 검사 과정을 강제로 통과시킴
        return
