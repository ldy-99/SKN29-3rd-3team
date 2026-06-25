import uuid

class RequestIdMiddleware:
    """
    모든 요청에 고유한 request_id(UUID)를 부여하는 미들웨어.
    이를 통해 응답 렌더링 및 에러 로그 등에서 추적이 용이해집니다.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = str(uuid.uuid4())
        response = self.get_response(request)
        response['X-Request-ID'] = request.request_id
        return response
