# --- 1단계: 빌드 스테이지 ---
FROM node:20-alpine AS build

WORKDIR /app

# pnpm 글로벌 설치
RUN npm install -g pnpm@10.14.0

# 의존성 관련 파일 복사 및 설치
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 소스 파일 복사 및 빌드 실행
COPY . .
RUN pnpm build

# --- 2단계: 실행 스테이지 (Nginx) ---
FROM nginx:stable-alpine

# 빌드 결과물 복사
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx 커스텀 설정 복사 (API Proxy 적용)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 포트 노출
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
