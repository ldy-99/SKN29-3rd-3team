# Django API

React와 내부 FastAPI/RAG 사이의 공개 API 계층입니다.

주요 책임:

- Django session 인증
- 사용자 프로필과 소유권 관리
- 전략 실행 snapshot·결과 저장
- FastAPI 요청 adapter와 proxy
- 공통 응답 envelope와 throttle

주요 코드:

```text
accounts/           사용자, 인증, 프로필
strategy/           공고, 전략 실행, FastAPI proxy
common/             인증, middleware, renderer, 예외 처리
config/settings.py  환경변수와 Django 설정
```

실행·테스트 명령은 [로컬 실행 가이드](../docs/LOCAL_SETUP.md)를 사용합니다. 공개 API는 [API 계약](../docs/API_CONTRACT.md)을 기준으로 합니다.
