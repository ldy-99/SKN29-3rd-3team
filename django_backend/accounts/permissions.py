from rest_framework import permissions

class IsOwner(permissions.BasePermission):
    """
    객체의 소유자만 해당 객체를 수정하거나 조회할 수 있도록 제한하는 커스텀 권한 클래스.
    """
    def has_object_permission(self, request, view, obj):
        # request.user가 인증되었고, 객체의 user 필드와 일치하는지 검사
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Profile 모델 등의 경우 user 필드가 직접 연결되어 있으므로 비교
        if hasattr(obj, 'user'):
            return obj.user == request.user
            
        return False
