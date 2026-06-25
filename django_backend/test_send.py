# test_send.py
import requests
import json
import random
import time
import os

BASE_URL = "http://127.0.0.1:8000"

def get_fixture_path(filename):
    # test_send.py 위치 기준으로 fixture_examples 경로를 동적으로 구함
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, "..", "fixture_examples", filename))

def run_user_journey():
    # requests.Session을 사용하면 로그인 시 발급되는 세션 쿠키(sessionid)가 자동으로 보존되어
    # 이후 요청 시 함께 전송됩니다. (실제 브라우저 환경과 동일하게 동작)
    session = requests.Session()
    
    # 1. 고유한 테스트 사용자 계정명 생성 (실행 시 중복 에러 방지)
    rand_id = random.randint(1000, 9999)
    username = f"flow_user_{rand_id}"
    email = f"flow_{rand_id}@example.com"
    password = "testpassword123!"

    print("=" * 60)
    print("🚀 [시나리오 1단계] 회원가입 진행 (POST /api/auth/signup)")
    print(f"👉 가입 계정: {username} / {email}")
    print("=" * 60)
    
    signup_url = f"{BASE_URL}/api/auth/signup"
    signup_payload = {
        "username": username,
        "email": email,
        "password": password
    }
    
    try:
        response = session.post(signup_url, json=signup_payload)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ 요청 실패: {e}")
        return
    
    if response.status_code not in (200, 201):
        print("❌ 회원가입 실패로 테스트를 중단합니다.")
        return
        
    time.sleep(1)

    print("\n" + "=" * 60)
    print("🚀 [시나리오 2단계] 현재 로그인 세션 상태 조회 (GET /api/auth/me)")
    print("=" * 60)
    
    me_url = f"{BASE_URL}/api/auth/me"
    try:
        response = session.get(me_url)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ 요청 실패: {e}")
        return
    
    time.sleep(1)

    print("\n" + "=" * 60)
    print("🚀 [시나리오 3단계] 사용자 청약 프로필 작성 (PUT /api/user/profile)")
    print("=" * 60)
    
    # fixture_examples의 profile-basic-p0.json 파일 읽기
    fixture_path = get_fixture_path("profile-basic-p0.json")
    try:
        with open(fixture_path, "r", encoding="utf-8") as f:
            profile_data = json.load(f)
        print(f"✅ Fixture 파일 로드 완료: {fixture_path}")
    except FileNotFoundError:
        print(f"⚠️ '{fixture_path}' 파일을 찾을 수 없어 기본 모크 데이터로 대체합니다.")
        profile_data = {
            "bankbook_type": "RE subscription",
            "bankbook_join_date": "2022-01-15",
            "bankbook_payment_count": 24,
            "bankbook_balance_krw": 2400000,
            "residence_region": "SEOUL",
            "is_homeless": True,
            "is_household_head": True,
            "household_member_count": 2,
            "birth_year": 1995,
            "marital_status": "SINGLE",
            "minor_child_count": 0,
            "has_household_property_ownership_history": False
        }
        
    profile_url = f"{BASE_URL}/api/user/profile"
    try:
        response = session.put(profile_url, json=profile_data)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ 요청 실패: {e}")
        return
    
    if response.status_code != 200:
        print("❌ 프로필 저장 실패로 테스트를 중단합니다.")
        return
        
    time.sleep(1)

    print("\n" + "=" * 60)
    print("🚀 [시나리오 4단계] 모집공고문 PDF 파일 분석 위임 (POST /api/pdf/analyze)")
    print("👉 ※ 만약 내부 FastAPI 서버가 켜져 있지 않다면 502 배드 게이트웨이 에러가 발생합니다.")
    print("=" * 60)

    pdf_url = f"{BASE_URL}/api/pdf/analyze"
    pdf_files = {
        'file': ('test_announcement.pdf', b'%PDF-1.4 mock pdf structure bytes data', 'application/pdf')
    }
    
    try:
        response = session.post(pdf_url, files=pdf_files)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ PDF 분석 프록시 요청 실패: {e}")
        
    time.sleep(1)

    print("\n" + "=" * 60)
    print("🚀 [시나리오 5단계] 분석/확정된 공고 조건 정보 개별 저장 (POST /api/user/announcement)")
    print("=" * 60)

    announcement_url = f"{BASE_URL}/api/user/announcement"
    announcement_payload = {
        "announcement_name": "힐스테이트 서울숲 분양공고",
        "region": "SEOUL",
        "regulated_area_type": "NON_REGULATED",
        "supply_category": "PRIVATE",
        "housing_type": "PRIVATE_HOUSING",
        "sale_price_krw": 850000000,
        "area_text": "84Sqm",
        "exclusive_area_sqm": 84.5
    }

    try:
        response = session.post(announcement_url, json=announcement_payload)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        resp_json = response.json()
        print(json.dumps(resp_json, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ 공고 저장 요청 실패: {e}")

    time.sleep(1)

    print("\n" + "=" * 60)
    print("🚀 [시나리오 6단계] 청약 자가진단 실행 (POST /api/strategy)")
    print("👉 ※ 만약 내부 FastAPI 서버가 켜져 있지 않다면 502 배드 게이트웨이 에러가 발생합니다.")
    print("=" * 60)
    
    strategy_url = f"{BASE_URL}/api/strategy"
    strategy_payload = {
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
    
    try:
        response = session.post(strategy_url, json=strategy_payload)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ 자가진단 요청 실패: {e}")
        
    time.sleep(1)

    print("\n" + "=" * 60)
    print("🚀 [시나리오 7단계] 챗봇 Proxy 질문 전송 (POST /api/chatbot)")
    print("👉 ※ 만약 내부 FastAPI 서버가 켜져 있지 않다면 502 배드 게이트웨이 에러가 발생합니다.")
    print("=" * 60)

    chatbot_url = f"{BASE_URL}/api/chatbot"
    chatbot_fixture_path = get_fixture_path("chatbot-request-question.json")
    try:
        with open(chatbot_fixture_path, "r", encoding="utf-8") as f:
            chatbot_payload = json.load(f)
        print(f"✅ Chatbot Fixture 파일 로드 완료: {chatbot_fixture_path}")
    except FileNotFoundError:
        print(f"⚠️ '{chatbot_fixture_path}' 파일을 찾을 수 없어 기본 질문으로 대체합니다.")
        chatbot_payload = {
            "question": "신혼부부 특별공급에서 소득 기준은 어떻게 확인하나요?",
            "session_id": None
        }

    try:
        response = session.post(chatbot_url, json=chatbot_payload)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ 챗봇 요청 실패: {e}")

    time.sleep(1)

    print("\n" + "=" * 60)
    print("🚀 [시나리오 8단계] 마이페이지 - 내가 수행한 청약 진단 목록 조회 (GET /api/strategy/me)")
    print("=" * 60)
    
    list_url = f"{BASE_URL}/api/strategy/me"
    try:
        response = session.get(list_url)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ 목록 조회 요청 실패: {e}")
        
    time.sleep(1)

    print("\n" + "=" * 60)
    print("🚀 [시나리오 9단계] 로그아웃 진행 및 세션 파기 (POST /api/auth/logout)")
    print("=" * 60)
    
    logout_url = f"{BASE_URL}/api/auth/logout"
    try:
        response = session.post(logout_url)
        print(f"상태 코드: {response.status_code}")
        print("응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ 로그아웃 요청 실패: {e}")
        
    print("\n✨ 사용자 가상 흐름 시나리오 테스트가 종료되었습니다.")

if __name__ == "__main__":
    run_user_journey()
