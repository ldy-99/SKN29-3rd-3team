# 1. Base 이미지 선택
FROM python:3.10-slim

# 2. 필수 시스템 패키지 및 시간대 설정
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Asia/Seoul

# 3. 작업 디렉토리 설정
WORKDIR /app

# 4. 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . .

# 6. 포트 노출 (Django 기본 포트: 8000)
EXPOSE 8000

# 7. 실행 명령 (컨테이너 실행 시 자동 마이그레이션 적용 후 서버 시작)
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
