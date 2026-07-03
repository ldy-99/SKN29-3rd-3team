"""
역할: Django/DRF 예외를 공통 오류 응답 형식으로 변환합니다.
흐름: serializer/view/service 예외 -> custom_exception_handler -> EnvelopeJSONRenderer -> React ApiRequestError.
"""
from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError

def custom_exception_handler(exc, context):
    """
    예외가 발생했을 때 API 스펙에 적합한 JSON 에러 구조로 변환하는 핸들러.
    특히 ValidationError(400 Bad Request)인 경우 필드별 에러 배열을 반환합니다.
    """
    response = exception_handler(exc, context)

    if response is not None:
        if isinstance(exc, ValidationError):
            field_errors = {}
            if isinstance(exc.detail, dict):
                for field, errors in exc.detail.items():
                    if isinstance(errors, list):
                        field_errors[field] = [str(err) for err in errors]
                    else:
                        field_errors[field] = [str(errors)]
            elif isinstance(exc.detail, list):
                field_errors['non_field_errors'] = [str(err) for err in exc.detail]

            # 프로필 입력 오류 등의 스펙에 명시된 에러 코드/메시지 매핑
            code = getattr(exc, 'code', 'PROFILE_REQUIRED_FIELDS_MISSING')
            message = getattr(exc, 'message', '기본 진단에 필요한 프로필 필드가 누락되었습니다.')

            response.data = {
                "code": code,
                "message": message,
                "field_errors": field_errors
            }
        else:
            # 일반적인 HTTP 예외 처리
            code = getattr(exc, 'default_code', 'API_ERROR').upper()
            detail = exc.detail
            if isinstance(detail, dict):
                message = detail.get('detail', str(detail))
            elif isinstance(detail, list):
                message = ", ".join([str(d) for d in detail])
            else:
                message = str(detail)

            response.data = {
                "code": code,
                "message": message,
                "field_errors": {}
            }

    return response
