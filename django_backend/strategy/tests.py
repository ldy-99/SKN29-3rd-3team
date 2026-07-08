from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from unittest.mock import Mock, patch
from django.core.cache import cache
import requests
from accounts.models import Profile
from strategy.models import StrategyRun
from strategy.services import (
    FastAPIClient,
    FastAPIConnectionError,
    FastAPITimeoutError,
    FastAPIUpstreamError,
)
from strategy.views import _build_announcement_display_title

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

    def create_valid_profile(self):
        return Profile.objects.create(
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
            has_household_property_ownership_history=False,
        )

    def assert_error_envelope(self, response, expected_status, expected_code):
        self.assertEqual(response.status_code, expected_status)
        response_json = response.json()
        self.assertIsNone(response_json["data"])
        self.assertIn("request_id", response_json)
        self.assertEqual(response_json["error"]["code"], expected_code)
        self.assertTrue(response_json["error"]["message"])
        self.assertNotIn("Traceback", response_json["error"]["message"])
        self.assertNotIn("requests.exceptions", response_json["error"]["message"])

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
    def test_strategy_run_fastapi_timeout_returns_error_envelope(self, mock_run_diagnosis):
        self.create_valid_profile()
        mock_run_diagnosis.side_effect = FastAPITimeoutError()

        response = self.client.post(
            reverse('strategy-run'),
            {"announcement_text": "announcement"},
            format='json',
        )

        self.assert_error_envelope(response, status.HTTP_504_GATEWAY_TIMEOUT, "FASTAPI_TIMEOUT")
        self.assertEqual(StrategyRun.objects.get(user=self.user).status, "FAILED")

    @patch('strategy.views.FastAPIClient.run_diagnosis')
    def test_strategy_run_fastapi_connection_failure_returns_error_envelope(self, mock_run_diagnosis):
        self.create_valid_profile()
        mock_run_diagnosis.side_effect = FastAPIConnectionError()

        response = self.client.post(
            reverse('strategy-run'),
            {"announcement_text": "announcement"},
            format='json',
        )

        self.assert_error_envelope(
            response,
            status.HTTP_502_BAD_GATEWAY,
            "FASTAPI_CONNECTION_FAILED",
        )
        self.assertNotIn("ConnectionError", response.json()["error"]["message"])
        self.assertEqual(StrategyRun.objects.get(user=self.user).status, "FAILED")

    @patch('strategy.views.FastAPIClient.run_diagnosis')
    def test_strategy_run_fastapi_500_returns_upstream_error_envelope(self, mock_run_diagnosis):
        self.create_valid_profile()
        mock_run_diagnosis.side_effect = FastAPIUpstreamError()

        response = self.client.post(
            reverse('strategy-run'),
            {"announcement_text": "announcement"},
            format='json',
        )

        self.assert_error_envelope(
            response,
            status.HTTP_502_BAD_GATEWAY,
            "FASTAPI_UPSTREAM_ERROR",
        )
        self.assertNotIn("500 Server Error", response.json()["error"]["message"])
        self.assertEqual(StrategyRun.objects.get(user=self.user).status, "FAILED")

    @patch('strategy.views.FastAPIClient.run_diagnosis')
    def test_strategy_run_api_flow_creates_history_and_detail_without_external_call(self, mock_run_diagnosis):
        self.create_valid_profile()
        mock_run_diagnosis.return_value = {
            "status": "SUCCEEDED",
            "eligibility": "PASS",
            "score": 72,
            "message": "ok",
        }

        create_response = self.client.post(
            reverse('strategy-run'),
            {
                "announcement_text": "manual announcement",
                "input_method": "manual",
                "source_filename": "manual.txt",
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created = create_response.json()["data"]
        self.assertEqual(created["status"], "SUCCEEDED")
        self.assertEqual(created["result_payload"]["score"], 72)

        list_response = self.client.get(reverse('strategy-list'))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.json()["data"]), 1)

        detail_response = self.client.get(reverse('strategy-detail', kwargs={"strategy_id": created["id"]}))
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.json()["data"]["result_payload"]["eligibility"], "PASS")
        mock_run_diagnosis.assert_called_once()

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
        self.assertEqual(announcement["display_title"], "테스트 공고")
        self.assertEqual(announcement["pdf_analysis_id"], "pdf-analysis-id")
        self.assertEqual(announcement["pdf_summary_text"], "[PDF 공고문 핵심 요약]")
        self.assertEqual(
            announcement["pdf_extracted_fields"]["price_summary"]["max_krw"],
            1707000000,
        )

    def test_pdf_display_title_ignores_diagnosis_helper_heading(self):
        """
        PDF 진단용 정리 헤더가 공고 제목으로 저장되지 않고 파일명 후보로 fallback되는지 검증
        """
        title = _build_announcement_display_title(
            source_filename="공고문_영천해피포유미분양매입잔여세대선착순일반매각공고.pdf",
            announcement_text="[아파트 청약 진단용 공고문 정리]\n- 공고명: 확인 필요",
        )

        self.assertEqual(title, "영천해피포유")

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

    @patch('strategy.views.FastAPIClient.proxy_pdf_analysis')
    def test_pdf_upload_timeout_returns_error_envelope(self, mock_proxy_pdf_analysis):
        from django.core.files.uploadedfile import SimpleUploadedFile

        mock_proxy_pdf_analysis.side_effect = FastAPITimeoutError()
        fake_pdf = SimpleUploadedFile(
            "announcement.pdf",
            b"%PDF-1.4 mock pdf body",
            content_type="application/pdf",
        )

        response = self.client.post(reverse('pdf-analyze'), {"file": fake_pdf}, format='multipart')

        self.assert_error_envelope(response, status.HTTP_504_GATEWAY_TIMEOUT, "FASTAPI_TIMEOUT")

    def test_pdf_upload_too_large_returns_error_envelope(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        fake_pdf = SimpleUploadedFile(
            "large.pdf",
            b"%PDF-1.4" + b"x" * (15 * 1024 * 1024 + 1),
            content_type="application/pdf",
        )

        response = self.client.post(reverse('pdf-analyze'), {"file": fake_pdf}, format='multipart')

        self.assert_error_envelope(response, status.HTTP_400_BAD_REQUEST, "PDF_TOO_LARGE")

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
    def test_chatbot_timeout_returns_error_envelope(self, mock_call_chatbot):
        mock_call_chatbot.side_effect = FastAPITimeoutError()

        response = self.client.post(
            reverse('chatbot'),
            {"question": "subscription question", "session_id": None},
            format='json',
        )

        self.assert_error_envelope(response, status.HTTP_504_GATEWAY_TIMEOUT, "FASTAPI_TIMEOUT")

    @patch('strategy.views.FastAPIClient.call_chatbot')
    def test_chatbot_connection_failure_returns_error_envelope(self, mock_call_chatbot):
        mock_call_chatbot.side_effect = FastAPIConnectionError()

        response = self.client.post(
            reverse('chatbot'),
            {"question": "subscription question", "session_id": None},
            format='json',
        )

        self.assert_error_envelope(
            response,
            status.HTTP_502_BAD_GATEWAY,
            "FASTAPI_CONNECTION_FAILED",
        )

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
    def test_send_profile_timeout_maps_to_fastapi_timeout(self):
        client = FastAPIClient()

        with patch(
            'strategy.services.requests.post',
            side_effect=requests.exceptions.Timeout("socket timed out"),
        ):
            with self.assertRaises(FastAPITimeoutError) as context:
                client.send_profile({"region": "SEOUL"})

        self.assertEqual(context.exception.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertEqual(context.exception.default_code, "FASTAPI_TIMEOUT")
        self.assertNotIn("socket timed out", str(context.exception.detail))

    def test_send_profile_connection_error_maps_to_fastapi_connection_failed(self):
        client = FastAPIClient()

        with patch(
            'strategy.services.requests.post',
            side_effect=requests.exceptions.ConnectionError("connection refused"),
        ):
            with self.assertRaises(FastAPIConnectionError) as context:
                client.send_profile({"region": "SEOUL"})

        self.assertEqual(context.exception.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(context.exception.default_code, "FASTAPI_CONNECTION_FAILED")
        self.assertNotIn("connection refused", str(context.exception.detail))

    def test_trigger_simulate_http_500_maps_to_fastapi_upstream_error(self):
        client = FastAPIClient()
        response = Mock()
        response.raise_for_status.side_effect = requests.exceptions.HTTPError(
            "500 Server Error: Internal Server Error"
        )

        with patch('strategy.services.requests.post', return_value=response):
            with self.assertRaises(FastAPIUpstreamError) as context:
                client.trigger_simulate("session-id", simulate=False)

        self.assertEqual(context.exception.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(context.exception.default_code, "FASTAPI_UPSTREAM_ERROR")
        self.assertNotIn("500 Server Error", str(context.exception.detail))

    def test_call_chatbot_timeout_maps_to_fastapi_timeout(self):
        client = FastAPIClient()

        with patch(
            'strategy.services.requests.post',
            side_effect=requests.exceptions.Timeout("chat timed out"),
        ):
            with self.assertRaises(FastAPITimeoutError):
                client.call_chatbot("question", session_id=None)

    def test_proxy_pdf_analysis_timeout_maps_to_fastapi_timeout(self):
        client = FastAPIClient()

        with patch(
            'strategy.services.requests.post',
            side_effect=requests.exceptions.Timeout("pdf timed out"),
        ):
            with self.assertRaises(FastAPITimeoutError):
                client.proxy_pdf_analysis("announcement.pdf", b"%PDF-1.4")

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
