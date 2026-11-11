#!/usr/bin/env bash
# BlueDental deploy script
# Chay:  bash deploy.sh          (neu da co quyen docker)
#        sudo bash deploy.sh     (neu chay bang root)
#
# Mac dinh build image ngay tren may nay. Neu co API_IMAGE + FRONTEND_IMAGE
# (CD cua nhanh develop truyen vao) thi KHONG build: keo image da build san
# tren GitHub Actions ve. VM staging dung chung, 11 GB RAM, khong swap --
# `dotnet publish` trong luc build an 3.5 GB va lam treo ca may.
set -euo pipefail

cd "$(dirname "$0")"
[[ -f .env ]] || { echo "!! Thieu file .env"; exit 1; }

echo "==> [1/6] Trang thai hien tai"
docker compose ps || true

echo
NO_BUILD=
if [[ -n "${API_IMAGE:-}" && -n "${FRONTEND_IMAGE:-}" ]]; then
  echo "==> [2/6] Keo image da build san (khong build tren may nay)"
  # CD dang nhap GHCR vao mot docker config tam; chay tay thi dung ~/.docker.
  GHCR_CONFIG="$HOME/.cache/bluedental-ghcr"
  pull() { if [[ -d "$GHCR_CONFIG" ]]; then docker --config "$GHCR_CONFIG" pull "$1"; else docker pull "$1"; fi; }
  pull "$API_IMAGE"
  pull "$FRONTEND_IMAGE"
  # Ten ma compose tu dat cho service co `build:` (project "bluedental"), nen
  # docker-compose.yml khong phai doi va `up` thay image moi la tao lai container.
  docker tag "$API_IMAGE" bluedental-api
  docker tag "$API_IMAGE" bluedental-migrator
  docker tag "$FRONTEND_IMAGE" bluedental-frontend
  docker rmi "$API_IMAGE" "$FRONTEND_IMAGE" >/dev/null || true   # chi go tag ghcr
  NO_BUILD=1
else
  echo "==> [2/6] Build image api + frontend (co the mat 5-10 phut lan dau)"
  docker compose build --pull api frontend migrator
fi

echo
echo "==> [3/6] Khoi dong infra (postgres, redis, minio, clamav, gotenberg)"
docker compose up -d postgres redis minio clamav gotenberg
echo "    Cho healthcheck..."
for svc in postgres redis minio clamav gotenberg; do
  for _ in $(seq 1 60); do
    st=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q $svc)" 2>/dev/null || echo starting)
    [[ "$st" == healthy ]] && break
    sleep 5
  done
  echo "    $svc: ${st:-unknown}"
done

echo
echo "==> [4/6] Chay migrator (tao schema + seed du lieu)"
if ! docker compose run --rm migrator; then
  echo "!! MIGRATOR THAT BAI. Log 100 dong cuoi:"
  docker compose logs --tail=100 migrator || true
  exit 1
fi

echo
echo "==> [5/6] Khoi dong api + frontend (+ caddy neu dung docker-compose.prod.yml)"
docker compose up -d ${NO_BUILD:+--no-build}

echo "    Cho api healthy..."
for _ in $(seq 1 60); do
  st=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q api)" 2>/dev/null || echo starting)
  [[ "$st" == healthy ]] && break
  [[ "$st" == unhealthy ]] && { echo "!! API UNHEALTHY. Log:"; docker compose logs --tail=100 api; exit 1; }
  sleep 5
done
echo "    api: ${st:-unknown}"

echo
echo "==> [6/6] Kiem tra"
docker compose ps
echo
echo -n "    API health (noi bo): "; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5019/health/ready || echo FAIL
WEB_BIND=$(grep '^WEB_BIND_ADDRESS=' .env | cut -d= -f2); WEB_BIND=${WEB_BIND:-127.0.0.1}
WEB_PORT=$(grep '^WEB_PORT=' .env | cut -d= -f2); WEB_PORT=${WEB_PORT:-8080}
[[ "$WEB_BIND" == 0.0.0.0 ]] && WEB_BIND=127.0.0.1
echo -n "    Frontend /healthz  : "; curl -s "http://$WEB_BIND:$WEB_PORT/healthz" || echo FAIL
echo -n "    Frontend -> /api   : "; curl -s -o /dev/null -w '%{http_code}\n' "http://$WEB_BIND:$WEB_PORT/health" || echo FAIL
# TLS khong con thuoc ve deploy nay: Caddy da tach ra ~/proxy (dung chung
# voi blueidea + staylio). Kiem tra HTTPS nam o buoc "Smoke test" cua CD.

echo
echo "======================================================"
echo " Deploy xong."
echo " URL      : $(grep '^FRONTEND_URL=' .env | cut -d= -f2)"
echo " Admin    : $(grep '^SEED_ADMIN_EMAIL=' .env | cut -d= -f2)"
echo "======================================================"
