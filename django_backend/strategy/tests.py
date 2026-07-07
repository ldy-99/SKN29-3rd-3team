from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from unittest.mock import patch
from django.core.cache import cache
from accounts.models import Profile
from strategy.models import StrategyRun
from strategy.services import FastAPIClient

User = get_user_model()

class StrategyAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        # 테스트용 사용자 생성
        self.user = User.objects.create_user(
            username="strategy_tester",
            email="tester@example.com",
            password="testpassword123"
        )
        self.client.force_authenticate(user=self.user)

    def test_strategy_run_missing_profile(self):
        """
        프로필이 존재하지 않을 때 진단 실행 시 PROFILE_REQUIRED 발생 검증
        """
        url = reverse('strategy-run')
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_json = response.json()
        self.assertEqual(response_json['error']['code'], 'PROFILE_REQUIRED')

    def test_strategy_run_profile_fields_missing(self):
        """
        프로필은 존재하나 필수 필드가 누락되었을 때 PROFILE_REQUIRED_FIELDS_MISSING 발생 검증
        """
        Profile.objects.create(
            user=self.user,
            bankbook_type=None,
            bankbook_join_date="2022-01-15",
            bankbook_payment_count=24,
            bankbook_balance_krw=2400000,
            residence_region="SEOUL"
        )
        
        url = reverse('strategy-run')
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_json = response.json()
        self.assertEqual(response_json['error']['code'], 'PROFILE_REQUIRED_FIELDS_MISSING')

    @patch('strategy.views.FastAPIClient.run_diagnosis')
    def test_strategy_run_success(self, mock_run_diagnosis):
        """
        유효한 프로필과 공고 조건을 활용해 진단 실행이 성공(SUCCEEDED)하고 이력이 남는지 검증
        """
        mock_run_diagnosis.return_value = {
            "status": "SUCCEEDED",
            "eligibility": "PASS",
            "score": 84,
            "message": "청약 가점 조건을 충족합니다."
        }

        Profile.objects.create(
            user=self.user,
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

        req_data = {
            "announcement": {
                "announcement_text": "테스트용 모집공고문 요약 전문",
                "announcement_name": "힐스테이트 서울숲 분양공고",
                "region": "SEOUL",
                "regulated_area_type": "NON_REGULATED",
                "supply_category": "PRIVATE",
                "housing_type": "PRIVATE_HOUSING",
                "sale_price_krw": 850000000,
                "area_text": "84Sqm",
                "exclusive_area_sqm": 84.5
            }
        }

        url = reverse('strategy-run')
        response = self.client.post(url, req_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        response_json = response.json()
        self.assertIsNone(response_json['error'])
        self.assertEqual(response_json['data']['status'], 'SUCCEEDED')
        self.assertEqual(response_json['data']['result_payload']['eligibility'], 'PASS')
        
        self.assertTrue(StrategyRun.objects.filter(user=self.user).exists())

    @patch('strategy.views.FastAPIClient.run_diagnosis')
    def test_strategy_run_preserves_pdf_metadata_in_snapshot(self, mock_run_diagnosis):
        """
        PDF 분석 후 전략 진단 실행 시 요약/구조화 메타데이터가 이력 스냅샷에 남는지 검증
        """
        mock_run_diagnosis.return_value = {
            "status": "success",
            "report": {"summary": "PDF 기반 진단 완료"},
            "warnings": [],
        }

        Profile.objects.create(
            user=self.user,
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

        req_data = {
            "announcement_text": "[아파트 청약 진단용 공고문 정리]",
            "profile_only": False,
            "input_method": "pdf",
            "source_filename": "notice.pdf",
            "pdf_analysis_id": "pdf-analysis-id",
            "pdf_summary_text": "[PDF 공고문 핵심 요약]",
            "pdf_extracted_fields": {
                "announcement_name": "테스트 공고",
                "price_summary": {
                    "min_krw": 1206000000,
                    "max_krw": 1707000000,
                },
            },
        }

        url = reverse('strategy-run')
        response = self.client.post(url, req_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        run = StrategyRun.objects.get(user=self.user)
        announcement = run.input_snapshot["announcement"]
        self.assertEqual(announcement["input_method"], "pdf")
        self.assertEqual(announcement["pdf_analysis_id"], "pdf-analysis-id")
        self.assertEqual(announcement["pdf_summary_text"], "[PDF 공고문 핵심 요약]")
        self.assertEqual(
            announcement["pdf_extracted_fields"]["price_summary"]["max_krw"],
            1707000000,
        )

    def test_strategy_list_and_detail(self):
        """
        진단 이력 목록 조회 및 상세 단건 조회 검증
        """
        run = StrategyRun.objects.create(
            user=self.user,
            status='SUCCEEDED',
            input_snapshot={"profile": {}, "announcement": {}},
            result_payload={"eligibility": "PASS"}
        )

        list_url = reverse('strategy-list')
        response_list = self.client.get(list_url)
        self.assertEqual(response_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_list.json()['data']), 1)

        detail_url = reverse('strategy-detail', kwargs={"strategy_id": run.id})
        response_detail = self.client.get(detail_url)
        self.assertEqual(response_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(response_detail.json()['data']['result_payload']['eligibility'], 'PASS')

        other_user = User.objects.create_user(
            username="other_tester",
            email="other@example.com",
            password="testpassword123"
        )
        self.client.force_authenticate(user=other_user)
        response_unauthorized = self.client.get(detail_url)
        self.assertEqual(response_unauthorized.status_code, status.HTTP_403_FORBIDDEN)

    def test_pdf_upload_invalid_type(self):
        """
        PDF 형식이 아닌 파일을 업로드했을 때 PDF_INVALID_TYPE 발생 검증
        """
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_file = SimpleUploadedFile("test.txt", b"this is raw text content", content_type="text/plain")
        
        url = reverse('pdf-analyze')
        response = self.client.post(url, {"file": fake_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_json = response.json()
        self.assertEqual(response_json['error']['code'], 'PDF_INVALID_TYPE')

    @patch('strategy.views.FastAPIClient.proxy_pdf_analysis')
    def test_pdf_upload_success(self, mock_proxy_pdf_analysis):
        """
        정상 PDF 업로드 시 FastAPI PDF 분석 프록시가 호출되고 결과를 반환하는지 검증
        """
        mock_proxy_pdf_analysis.return_value = {
            "pdf_analysis_id": "test-pdf-analysis",
            "extraction_status": "SUCCESS",
            "filename": "announcement.pdf",
            "page_count": 1,
            "text_length": 120,
            "combined_text_length": 120,
            "table_count": 0,
            "truncated": False,
            "preview": "모집공고 미리보기",
            "combined_text": "모집공고 전문",
            "warnings": [],
        }
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_pdf = SimpleUploadedFile("announcement.pdf", b"%PDF-1.4 mock pdf body", content_type="application/pdf")
        
        url = reverse('pdf-analyze')
        response = self.client.post(url, {"file": fake_pdf}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_json = response.json()
        self.assertIsNone(response_json['error'])
        self.assertEqual(response_json['data']['pdf_analysis_id'], 'test-pdf-analysis')
        mock_proxy_pdf_analysis.assert_called_once()

    def test_announcement_create_invalid(self):
        """
        유효하지 않은 공고 정보를 등록 시 에러 발생 검증
        """
        invalid_data = {
            "region": "SEOUL",
            "supply_category": "UNKNOWN"
        }
        url = reverse('announcement-create')
        response = self.client.post(url, invalid_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_announcement_create_and_detail_success(self):
        """
        공고 정보 정상 저장 및 권한 제어(IsOwner) 작동 검증
        """
        valid_data = {
            "region": "SEOUL",
            "supply_category": "PRIVATE",
            "area_text": "84㎡",
            "announcement_name": "수동 입력 단지"
        }
        url = reverse('announcement-create')
        response = self.client.post(url, valid_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        response_json = response.json()
        self.assertIsNone(response_json['error'])
        announcement_id = response_json['data']['id']

        # 본인이 조회할 경우
        detail_url = reverse('announcement-detail', kwargs={"announcement_id": announcement_id})
        response_detail = self.client.get(detail_url)
        self.assertEqual(response_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(response_detail.json()['data']['announcement_name'], "수동 입력 단지")

        # 타인 계정으로 조회할 경우
        other_user = User.objects.create_user(
            username="other_tester_announce",
            email="other_announce@example.com",
            password="testpassword123"
        )
        self.client.force_authenticate(user=other_user)
        response_unauthorized = self.client.get(detail_url)
        self.assertEqual(response_unauthorized.status_code, status.HTTP_403_FORBIDDEN)

    def test_chatbot_missing_question(self):
        """
        question 필드가 누락되었을 때 400 에러 반환 검증
        """
        url = reverse('chatbot')
        response = self.client.post(url, {"session_id": "some-id"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('strategy.views.FastAPIClient.call_chatbot')
    def test_chatbot_success(self, mock_call_chatbot):
        """
        정상 요청 시 챗봇 프록시가 작동하여 200 OK와 연산 결과를 반환하는지 검증
        """
        mock_call_chatbot.return_value = {
            "answer": "신혼부부 소득요건 기준 가이드...",
            "session_id": "77777777-7777-7777-7777-777777777777",
            "sources": ["주택청약 FAQ"]
        }
        
        req_payload = {
            "question": "신혼부부 특공 소득요건 알려줘",
            "session_id": None
        }
        url = reverse('chatbot')
        response = self.client.post(url, req_payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_json = response.json()
        self.assertIsNone(response_json['error'])
        self.assertEqual(response_json['data']['answer'], "신혼부부 소득요건 기준 가이드...")

    @patch('strategy.views.FastAPIClient.call_chatbot')
    def test_chatbot_throttling(self, mock_call_chatbot):
        """
        단시간에 60회 초과 요청 시 Throttling(429 Too Many Requests) 제한 작동 검증
        """
        mock_call_chatbot.return_value = {"answer": "ok"}
        url = reverse('chatbot')
        
        # 60번 요청 실행
        for _ in range(60):
            response = self.client.post(url, {"question": "Hi"}, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
        # 61번째 요청 시 Throttling 걸림 (429)
        response_throttled = self.client.post(url, {"question": "Hi"}, format='json')
        self.assertEqual(response_throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class FastAPIClientFlowTests(APITestCase):
    def test_run_diagnosis_uses_fastapi_session_and_expected_order_with_announcement(self):
        client = FastAPIClient()
        calls = []

        def fake_send_profile(profile_data):
            calls.append(("profile", profile_data))
            return {"session_id": "fastapi-session"}

        def fake_trigger_simulate(session_id, simulate=True):
            calls.append(("simulate", session_id, simulate))
            return {"status": "waiting"}

        def fake_send_announcement(session_id, announcement_text):
            calls.append(("announcement", session_id, announcement_text))
            return {"status": "success", "session_id": session_id}

        client.send_profile = fake_send_profile
        client.trigger_simulate = fake_trigger_simulate
        client.send_announcement = fake_send_announcement

        result = client.run_diagnosis(
            session_id="django-run-id",
            profile_3rd={"region": "SEOUL"},
            announcement_text="announcement",
        )

        self.assertEqual(result["session_id"], "fastapi-session")
        self.assertEqual(
            calls,
            [
                ("profile", {"region": "SEOUL"}),
                ("simulate", "fastapi-session", True),
                ("announcement", "fastapi-session", "announcement"),
            ],
        )

    def test_run_diagnosis_profile_only_uses_fastapi_session(self):
        client = FastAPIClient()
        calls = []

        client.send_profile = lambda profile_data: {"session_id": "fastapi-session"}

        def fake_trigger_simulate(session_id, simulate=True):
            calls.append(("simulate", session_id, simulate))
            return {"status": "success", "session_id": session_id}

        client.trigger_simulate = fake_trigger_simulate

        result = client.run_diagnosis(
            session_id="django-run-id",
            profile_3rd={"region": "SEOUL"},
            announcement_text=None,
        )

        self.assertEqual(result["session_id"], "fastapi-session")
        self.assertEqual(calls, [("simulate", "fastapi-session", False)])

    def test_strategy_run_invalid_transition(self):
        user = User.objects.create_user(username="test_transition_user", password="pwd")
        run = StrategyRun.objects.create(
            user=user,
            status='PENDING'
        )
        with self.assertRaises(ValueError):
            run.transition_to('SUCCEEDED')
        
        run.transition_to('RUNNING')
        self.assertEqual(run.status, 'RUNNING')
        
        run.transition_to('SUCCEEDED')
        self.assertEqual(run.status, 'SUCCEEDED')
        
        with self.assertRaises(ValueError):
            run.transition_to('RUNNING')
