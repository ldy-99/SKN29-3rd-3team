from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.contrib.auth import get_user_model
from accounts.models import Profile

User = get_user_model()

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            'bankbook_type',
            'bankbook_join_date',
            'bankbook_payment_count',
            'bankbook_balance_krw',
            'residence_region',
            'is_homeless',
            'is_household_head',
            'household_member_count',
            'birth_year',
            'marital_status',
            'minor_child_count',
            'has_household_property_ownership_history',
            'is_dual_income'
        ]
        # partial=True가 아닐 때 Serializer 레벨에서 기본 필수 에러를 띄우기 위해
        # extra_kwargs를 통해 에러 메시지를 커스텀할 수도 있습니다.
        extra_kwargs = {
            'bankbook_type': {'required': True, 'allow_null': False},
            'bankbook_join_date': {'required': True, 'allow_null': False},
            'bankbook_payment_count': {'required': True, 'allow_null': False},
            'bankbook_balance_krw': {'required': True, 'allow_null': False},
            'residence_region': {'required': True, 'allow_null': False},
            'is_homeless': {'required': True, 'allow_null': False},
            'is_household_head': {'required': True, 'allow_null': False},
            'household_member_count': {'required': True, 'allow_null': False},
            'birth_year': {'required': True, 'allow_null': False},
            'marital_status': {'required': True, 'allow_null': False},
            'minor_child_count': {'required': True, 'allow_null': False},
            'has_household_property_ownership_history': {'required': True, 'allow_null': False},
            'is_dual_income': {'required': False, 'allow_null': True},
        }

    def validate_household_member_count(self, value):
        if value is not None and value < 1:
            raise ValidationError("1 이상이어야 합니다.")
        return value

    def validate_residence_region(self, value):
        if value is not None and value.strip() == "":
            raise ValidationError("빈 문자열은 허용하지 않습니다.")
        return value

    def validate(self, attrs):
        # 1. DRF 기본 required 검사가 동작하지만, 수동으로 12개 P0 필수 필드 누락 체크
        required_fields = [
            'bankbook_type', 'bankbook_join_date', 'bankbook_payment_count',
            'bankbook_balance_krw', 'residence_region', 'is_homeless',
            'is_household_head', 'household_member_count', 'birth_year',
            'marital_status', 'minor_child_count', 'has_household_property_ownership_history'
        ]
        
        errors = {}
        for field in required_fields:
            # partial 검증이 아닐 때만 필수 필드로 검사하도록 처리
            if not self.partial and (field not in attrs or attrs[field] is None):
                errors[field] = ["필수 입력값입니다."]

        # 2. 조건부 검증: marital_status가 MARRIED(기혼)인 경우 is_dual_income(맞벌이여부) 필수
        marital_status = attrs.get('marital_status', getattr(self.instance, 'marital_status', None))
        is_dual_income = attrs.get('is_dual_income', getattr(self.instance, 'is_dual_income', None))

        if marital_status == 'MARRIED' and is_dual_income is None:
            errors['is_dual_income'] = ["결혼 상태가 기혼인 경우, 맞벌이 여부는 필수 입력값입니다."]

        # 3. 에러 발생 시 공통 에러 응답용 메타 데이터(code, message)를 포함한 ValidationError 발생
        if errors:
            exc = ValidationError(errors)
            exc.code = "PROFILE_REQUIRED_FIELDS_MISSING"
            exc.message = "기본 진단에 필요한 프로필 필드가 누락되었습니다."
            raise exc

        return attrs


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']
        read_only_fields = ['id']


class SignUpSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'email']

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise ValidationError("이미 존재하는 사용자 이름입니다.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise ValidationError("이미 사용 중인 이메일입니다.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        from django.contrib.auth import authenticate
        user = authenticate(username=username, password=password)

        if not user:
            raise ValidationError("아이디 또는 비밀번호가 올바르지 않습니다.")
        
        attrs['user'] = user
        return attrs
