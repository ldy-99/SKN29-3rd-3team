"""
역할: DRF 응답을 React가 기대하는 공통 envelope 형식으로 감싸는 renderer입니다.
흐름: Django view Response -> EnvelopeJSONRenderer -> React client unwrap.
"""
from rest_framework.renderers import JSONRenderer
import uuid

class EnvelopeJSONRenderer(JSONRenderer):
    """
    모든 API 응답 형식을 공통 Envelope 포맷으로 통일하는 렌더러.
    포맷:
    {
        "data": ... 또는 null,
        "error": ... 또는 null,
        "request_id": "uuid"
    }
    """
    def render(self, data, accepted_media_type=None, renderer_context=None):
        request = renderer_context.get('request') if renderer_context else None
        request_id = getattr(request, 'request_id', str(uuid.uuid4())) if request else str(uuid.uuid4())
        response = renderer_context.get('response') if renderer_context else None

        # API 예외가 발생하여 exception_handler를 통해 가공된 에러 응답인 경우
        if response and response.exception:
            envelope = {
                "data": None,
                "error": data,
                "request_id": request_id
            }
        else:
            envelope = {
                "data": data,
                "error": None,
                "request_id": request_id
            }

        return super().render(envelope, accepted_media_type, renderer_context)
