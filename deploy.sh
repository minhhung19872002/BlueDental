#!/usr/bin/env bash
# BlueDental deploy script
# Chay:  bash deploy.sh          (neu da co quyen docker)
#        sudo bash deploy.sh     (neu chay bang root)
set -euo pipefail

cd "$(dirname "$0")"
[[ -f .env ]] || { echo "!! Thieu file .env"; exit 1; }

echo "==> [1/6] Trang thai hien tai"
docker compose ps || true

echo
echo "==> [2/6] Build image api + frontend (co the mat 5-10 phut lan dau)"
docker compose build --pull api frontend migrator

echo
echo "==> [3/6] Khoi dong infra (postgres, redis, minio, clamav)"
docker compose up -d postgres redis minio clamav
echo "    Cho healthcheck..."
for svc in postgres redis minio clamav; do
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
docker compose up -d

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
if docker compose ps --services 2>/dev/null | grep -qx caddy; then
  echo -n "    Caddy TLS cert     : "
  docker compose logs caddy 2>/dev/null | grep -q "certificate obtained successfully" && echo "OK" || echo "CHUA CO (kiem tra port 80/443 mo tu Internet; docker compose logs caddy)"
fi

echo
echo "======================================================"
echo " Deploy xong."
echo " URL      : $(grep '^FRONTEND_URL=' .env | cut -d= -f2)"
echo " Admin    : $(grep '^SEED_ADMIN_EMAIL=' .env | cut -d= -f2)"
echo " Password : $(grep '^SEED_ADMIN_PASSWORD=' .env | cut -d= -f2)"
echo "======================================================"
