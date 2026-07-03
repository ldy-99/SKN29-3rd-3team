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

            # 기본값 설정 (일반 유효성 검사 실패)
            default_code = 'VALIDATION_ERROR'
            default_message = '요청을 처리할 수 없습니다.'

            # 프로필 모델의 필수/선택 필드 집합
            profile_fields = {
                'bankbook_type', 'bankbook_join_date', 'bankbook_payment_count',
                'bankbook_balance_krw', 'residence_region', 'is_homeless',
                'is_household_head', 'household_member_count', 'birth_year',
                'marital_status', 'minor_child_count', 'has_household_property_ownership_history',
                'is_dual_income'
            }

            # 에러가 발생한 필드 중 프로필 관련 필드가 하나라도 있으면 프로필 누락 에러로 취급
            is_profile_error = False
            if isinstance(field_errors, dict):
                for field in field_errors.keys():
                    if field in profile_fields:
                        is_profile_error = True
                        break

            view = context.get('view') if context else None
            view_class_name = view.__class__.__name__ if view else ""
            
            if is_profile_error or "Profile" in view_class_name:
                default_code = 'PROFILE_REQUIRED_FIELDS_MISSING'
                default_message = '기본 진단에 필요한 프로필 필드가 누락되었습니다.'

            code = getattr(exc, 'code', default_code)
            message = getattr(exc, 'message', default_message)
            
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
