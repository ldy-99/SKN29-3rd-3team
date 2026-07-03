from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from accounts.models import Profile

User = get_user_model()

class ProfileAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="profile_tester",
            email="profile@example.com",
            password="testpassword123",
        )

    def authenticate_profile_user(self):
        self.client.force_authenticate(user=self.user)

    def test_authenticated_profile_not_found(self):
        """
        1. 인증된 사용자가 GET /api/profile/을 요청했을 때,
        프로필이 없는 상태이므로 404 NotFound 에러를 반환하는지 테스트합니다.
        (이때 공통 응답 봉투 및 에러 JSON 규격이 적용되어야 합니다.)
        """
        self.authenticate_profile_user()
        url = reverse('profile-detail')
        response = self.client.get(url)

        # 프로필이 존재하지 않으므로 HTTP 404
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # 공통 응답 봉투 검증
        response_json = response.json()
        self.assertIn('data', response_json)
        self.assertIn('error', response_json)
        self.assertIn('request_id', response_json)
        
        self.assertIsNone(response_json['data'])
        self.assertEqual(response_json['error']['code'], 'NOT_FOUND')

    def test_post_invalid_profile(self):
        """
        2. 필수 필드가 누락되거나 잘못된 데이터가 넘어왔을 때(profile-invalid.json 예시),
        400 Bad Request와 함께 PROFILE_REQUIRED_FIELDS_MISSING 에러 코드 및 상세 에러 배열을 반환하는지 검증합니다.
        """
        self.authenticate_profile_user()
        url = reverse('profile-detail')
        # 필수 필드 대부분이 누락되고, residence_region이 빈값이며, household_member_count가 0인 유효하지 않은 데이터
        invalid_data = {
            "bankbook_type": None,
            "bankbook_join_date": "2022-01-15",
            "bankbook_payment_count": 24,
            "bankbook_balance_krw": 2400000,
            "residence_region": "",
            "is_homeless": True,
            "is_household_head": True,
            "household_member_count": 0,
            "birth_year": 1995,
            "marital_status": "SINGLE",
            "minor_child_count": None,
            "has_household_property_ownership_history": False
        }

        response = self.client.post(url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        response_json = response.json()
        self.assertIsNone(response_json['data'])
        self.assertEqual(response_json['error']['code'], 'PROFILE_REQUIRED_FIELDS_MISSING')
        self.assertEqual(response_json['error']['message'], '기본 진단에 필요한 프로필 필드가 누락되었습니다.')
        
        # 필드별 에러 리스트 검증
        field_errors = response_json['error']['field_errors']
        self.assertIn('bankbook_type', field_errors)
        self.assertIn('residence_region', field_errors)
        self.assertIn('household_member_count', field_errors)
        self.assertIn('minor_child_count', field_errors)

        # 상세 에러 내용 검증
        self.assertEqual(field_errors['residence_region'], ["빈 문자열은 허용하지 않습니다."])
        self.assertEqual(field_errors['household_member_count'], ["1 이상이어야 합니다."])

    def test_post_valid_profile_single(self):
        """
        3. 올바른 프로필 데이터가 넘어왔을 때(미혼(SINGLE)인 경우 맞벌이 필드는 null로 제공),
        200 OK와 함께 데이터가 정상 저장되고 렌더링되는지 테스트합니다.
        """
        self.authenticate_profile_user()
        url = reverse('profile-detail')
        valid_data = {
            "bankbook_type": "RE subscription",
            "bankbook_join_date": "2022-01-15",
            "bankbook_payment_count": 24,
            "bankbook_balance_krw": 2400000,
            "residence_region": "SEOUL",
            "is_homeless": True,
            "is_household_head": True,
            "household_member_count": 1,
            "birth_year": 1995,
            "marital_status": "SINGLE",
            "minor_child_count": 0,
            "has_household_property_ownership_history": False,
            "is_dual_income": None
        }

        response = self.client.post(url, valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response_json = response.json()
        self.assertIsNone(response_json['error'])
        self.assertIsNotNone(response_json['data'])
        self.assertEqual(response_json['data']['residence_region'], "SEOUL")
        self.assertEqual(response_json['data']['marital_status'], "SINGLE")
        self.assertIsNone(response_json['data']['is_dual_income'])

        # DB에 실제 저장되었는지 검증
        self.assertTrue(Profile.objects.filter(user=self.user).exists())

    def test_post_conditional_validation_married(self):
        """
        4. 기혼(MARRIED) 상태일 때 맞벌이 여부(is_dual_income)가 누락되면
        에러가 발생하는지 검증합니다.
        """
        self.authenticate_profile_user()
        url = reverse('profile-detail')
        # marital_status가 기혼인데 is_dual_income이 누락됨
        invalid_married_data = {
            "bankbook_type": "RE subscription",
            "bankbook_join_date": "2022-01-15",
            "bankbook_payment_count": 24,
            "bankbook_balance_krw": 2400000,
            "residence_region": "SEOUL",
            "is_homeless": True,
            "is_household_head": True,
            "household_member_count": 2,
            "birth_year": 1995,
            "marital_status": "MARRIED",
            "minor_child_count": 0,
            "has_household_property_ownership_history": False,
            "is_dual_income": None # 기혼 시 필수값이어야 함
        }

        response = self.client.post(url, invalid_married_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        response_json = response.json()
        self.assertEqual(response_json['error']['code'], 'PROFILE_REQUIRED_FIELDS_MISSING')
        self.assertIn('is_dual_income', response_json['error']['field_errors'])

    def test_signup_success(self):
        """
        회원가입 성공 테스트.
        """
        signup_data = {
            "username": "test_user_new",
            "email": "newtest@example.com",
            "password": "testpassword123"
        }
        url = reverse('signup')
        response = self.client.post(url, signup_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        response_json = response.json()
        self.assertIsNone(response_json['error'])
        self.assertEqual(response_json['data']['username'], "test_user_new")

    def test_login_success_and_logout(self):
        """
        로그인 성공 및 로그아웃 테스트.
        """
        user = User.objects.create_user(
            username="login_test_user",
            email="logintest@example.com",
            password="testpassword123"
        )
        
        login_data = {
            "username": "login_test_user",
            "password": "testpassword123"
        }
        url = reverse('login')
        response = self.client.post(url, login_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_json = response.json()
        self.assertIsNone(response_json['error'])
        self.assertEqual(response_json['data']['username'], "login_test_user")

        # 현재 로그인된 유저 조회 (me)
        me_url = reverse('me')
        response_me = self.client.get(me_url)
        self.assertEqual(response_me.status_code, status.HTTP_200_OK)
        self.assertEqual(response_me.json()['data']['username'], "login_test_user")

        # 로그아웃 실행
        logout_url = reverse('logout')
        response_logout = self.client.post(logout_url)
        self.assertEqual(response_logout.status_code, status.HTTP_200_OK)

    def test_delete_user(self):
        """
        회원 탈퇴 테스트.
        """
        user = User.objects.create_user(
            username="delete_test_user",
            email="deletetest@example.com",
            password="testpassword123"
        )
        self.client.force_authenticate(user=user)
        
        url = reverse('delete-auth')
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(username="delete_test_user").exists())

    def test_put_profile_success(self):
        """
        프로필 전체 업데이트(PUT) 테스트.
        """
        user = User.objects.create_user(
            username="put_profile_user",
            email="putprofile@example.com",
            password="testpassword123"
        )
        self.client.force_authenticate(user=user)

        # 1. 초기 생성
        url = reverse('profile-detail')
        valid_data = {
            "bankbook_type": "RE subscription",
            "bankbook_join_date": "2022-01-15",
            "bankbook_payment_count": 24,
            "bankbook_balance_krw": 2400000,
            "residence_region": "SEOUL",
            "is_homeless": True,
            "is_household_head": True,
            "household_member_count": 1,
            "birth_year": 1995,
            "marital_status": "SINGLE",
            "minor_child_count": 0,
            "has_household_property_ownership_history": False
        }
        response = self.client.put(url, valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 2. 다른 값으로 PUT (덮어쓰기)
        updated_data = valid_data.copy()
        updated_data["residence_region"] = "INCHEON"
        updated_data["household_member_count"] = 2
        
        response_update = self.client.put(url, updated_data, format='json')
        self.assertEqual(response_update.status_code, status.HTTP_200_OK)
        self.assertEqual(response_update.json()['data']['residence_region'], "INCHEON")
        self.assertEqual(response_update.json()['data']['household_member_count'], 2)

    def test_patch_profile_success(self):
        """
        프로필 일부 업데이트(PATCH) 테스트.
        """
        user = User.objects.create_user(
            username="patch_profile_user",
            email="patchprofile@example.com",
            password="testpassword123"
        )
        self.client.force_authenticate(user=user)

        # 초기 프로필 객체 생성
        profile = Profile.objects.create(
            user=user,
            bankbook_type="RE subscription",
            bankbook_join_date="2022-01-15",
            bankbook_payment_count=24,
            bankbook_balance_krw=2400000,
            residence_region="SEOUL",
            is_homeless=True,
            is_household_head=True,
            household_member_count=1,
            birth_year=1995,
            marital_status="SINGLE",
            minor_child_count=0,
            has_household_property_ownership_history=False
        )

        url = reverse('profile-detail')
        patch_data = {
            "residence_region": "BUSAN",
            "household_member_count": 3
        }
        
        response = self.client.patch(url, patch_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_json = response.json()
        self.assertEqual(response_json['data']['residence_region'], "BUSAN")
        self.assertEqual(response_json['data']['household_member_count'], 3)
        # 패치하지 않은 다른 필드가 잘 유지되는지 검증
        self.assertEqual(response_json['data']['bankbook_payment_count'], 24)

    def test_signup_email_normalization(self):
        """
        회원가입 시 이메일 소문자 및 공백 제거(정규화) 검증.
        """
        signup_data = {
            "username": "norm_user",
            "email": "  NormUser@Example.Com  ",
            "password": "testpassword123"
        }
        url = reverse('signup')
        response = self.client.post(url, signup_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # 실제 저장된 유저의 이메일 확인
        user = User.objects.get(username="norm_user")
        self.assertEqual(user.email, "normuser@example.com")

    def test_signup_weak_password(self):
        """
        회원가입 시 너무 약한 비밀번호 입력 시 가입 거부(400 Bad Request) 검증.
        """
        signup_data = {
            "username": "weak_user",
            "email": "weak@example.com",
            "password": "123"  # 너무 짧고 흔한 비밀번호
        }
        url = reverse('signup')
        response = self.client.post(url, signup_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        response_json = response.json()
        self.assertIn('password', response_json['error']['field_errors'])
