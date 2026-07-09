from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_docker_compose_defines_required_runtime_services():
    compose = read_text("docker-compose.yml")

    assert "django-backend:" in compose
    assert "fastapi-backend:" in compose
    assert "frontend:" in compose
    assert "context: ./django_backend" in compose
    assert "context: ./Backend" in compose
    assert "context: ./frontend-react" in compose
    assert "dockerfile: Dockerfile" in compose


def test_docker_compose_pins_expected_ports_and_internal_service_routes():
    compose = read_text("docker-compose.yml")
    prod_compose = read_text("docker-compose.prod.yml")

    assert '"8000:8000"' in compose
    assert '"8080:8080"' in compose
    assert '"3000:80"' in compose
    assert '"80:80"' in prod_compose
    assert "FASTAPI_API_URL=http://fastapi-backend:8080" in compose
    assert "depends_on:\n      - fastapi-backend" in compose
    assert "depends_on:\n      - django-backend\n      - fastapi-backend" in compose


def test_docker_compose_keeps_runtime_env_and_persistent_django_volume():
    compose = read_text("docker-compose.yml")
    prod_compose = read_text("docker-compose.prod.yml")

    assert "env_file:\n      - .env" in compose
    assert "env_file:\n      - runtime.env" in prod_compose
    assert "- django-db:/app/data" in compose
    assert "volumes:\n  django-db:" in compose
    assert "image: dongyoon99/django-backend:latest" in compose
    assert "image: dongyoon99/fastapi-backend:latest" in compose
    assert "image: dongyoon99/frontend-react:latest" in compose


def test_django_container_runs_migration_and_collectstatic_before_gunicorn():
    dockerfile = read_text("django_backend/Dockerfile")
    requirements = read_text("django_backend/requirements.txt")

    assert "FROM python:3.10-slim" in dockerfile
    assert "COPY requirements.txt ." in dockerfile
    assert "pip install --no-cache-dir -r requirements.txt" in dockerfile
    assert "EXPOSE 8000" in dockerfile
    assert "python manage.py migrate && python manage.py collectstatic --noinput" in dockerfile
    assert "gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3" in dockerfile
    assert "gunicorn==" in requirements
    assert "whitenoise==" in requirements


def test_fastapi_container_exposes_uvicorn_on_internal_compose_port():
    dockerfile = read_text("Backend/Dockerfile")

    assert "FROM python:3.10-slim" in dockerfile
    assert "COPY requirements.txt ." in dockerfile
    assert "pip install --no-cache-dir -r requirements.txt" in dockerfile
    assert "EXPOSE 8080" in dockerfile
    assert '"uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"' in dockerfile


def test_frontend_container_builds_static_assets_and_serves_with_nginx_proxy():
    dockerfile = read_text("frontend-react/Dockerfile")
    nginx_conf = read_text("frontend-react/nginx.conf")

    assert "FROM node:20-alpine AS build" in dockerfile
    assert "npm install -g pnpm@10.14.0" in dockerfile
    assert "RUN pnpm install --frozen-lockfile" in dockerfile
    assert "RUN pnpm build" in dockerfile
    assert "FROM nginx:stable-alpine" in dockerfile
    assert "COPY nginx.conf /etc/nginx/conf.d/default.conf" in dockerfile
    assert "EXPOSE 80" in dockerfile
    assert "try_files $uri $uri/ /index.html;" in nginx_conf
    assert "proxy_pass http://django-backend:8000/api/;" in nginx_conf
    assert "proxy_pass http://django-backend:8000/admin/;" in nginx_conf
    assert "proxy_pass http://django-backend:8000/static/admin/;" in nginx_conf
    assert "client_max_body_size 20M" in nginx_conf


def test_deploy_nginx_proxy_matches_compose_service_names_admin_and_upload_limit():
    nginx_conf = read_text("deploy/nginx/default.conf")

    assert "client_max_body_size 20m" in nginx_conf
    assert "proxy_pass http://django-backend:8000/api/;" in nginx_conf
    assert "proxy_pass http://django-backend:8000/admin/;" in nginx_conf
    assert "proxy_pass http://django-backend:8000/static/admin/;" in nginx_conf
    assert "proxy_pass http://django:8000" not in nginx_conf


def test_env_example_documents_required_deployment_runtime_variables():
    env_example = read_text(".env.example")

    for key in [
        "OPENAI_API_KEY=",
        "DJANGO_SECRET_KEY=",
        "DJANGO_ALLOWED_HOSTS=",
        "DJANGO_CORS_ALLOWED_ORIGINS=",
        "DJANGO_CSRF_TRUSTED_ORIGINS=",
        "FASTAPI_API_URL=",
        "FASTAPI_PROFILE_TIMEOUT=",
        "FASTAPI_SIMULATE_TIMEOUT=",
        "FASTAPI_CHATBOT_TIMEOUT=",
        "FASTAPI_ANNOUNCEMENT_TIMEOUT=",
        "FASTAPI_PDF_TIMEOUT=",
    ]:
        assert key in env_example


def test_production_env_example_documents_hardened_runtime_defaults():
    env_example = read_text(".env.production.example")

    for key in [
        "OPENAI_API_KEY=",
        "DJANGO_SECRET_KEY=",
        "DJANGO_DEBUG=false",
        "DJANGO_ALLOWED_HOSTS=",
        "DJANGO_CORS_ALLOWED_ORIGINS=http://a-fit.duckdns.org",
        "DJANGO_CSRF_TRUSTED_ORIGINS=http://a-fit.duckdns.org",
        "FASTAPI_API_URL=http://fastapi-backend:8080",
        "FASTAPI_PROFILE_TIMEOUT=",
        "FASTAPI_SIMULATE_TIMEOUT=",
        "FASTAPI_CHATBOT_TIMEOUT=",
        "FASTAPI_ANNOUNCEMENT_TIMEOUT=",
        "FASTAPI_PDF_TIMEOUT=",
        "DJANGO_SESSION_COOKIE_SECURE=false",
        "DJANGO_CSRF_COOKIE_SECURE=false",
    ]:
        assert key in env_example
