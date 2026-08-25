# Caddy đã chuyển ra khỏi repo này

TLS và cổng 80/443 do một Caddy **dùng chung cho cả máy** đảm nhiệm, đặt tại
`~/proxy` trên server — không thuộc repo nào.

Lý do: máy này còn phục vụ `blueidea.bluestar.com.vn` và
`staylio.bluestar.com.vn`. Khi Caddy còn nằm trong `docker-compose.prod.yml`
của BlueDental, vhost của hai site kia buộc phải chèn vào
`deploy/caddy/Caddyfile` — và mỗi lần CD chạy `git reset --hard` là bị xoá
sạch, kéo sập hai site không liên quan gì đến lần deploy đó.

```
~/proxy/
  docker-compose.yml          # project "proxy", giữ volume bluedental_caddy_data
  Caddyfile                   # chỉ có: import /etc/caddy/sites/*.caddy
  sites/bluedental.caddy      # <- vhost của dự án này
  sites/blueidea.caddy
  sites/stayhost.caddy
```

Sửa vhost của BlueDental thì sửa `~/proxy/sites/bluedental.caddy` rồi:

```bash
cd ~/proxy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Không cần deploy lại ứng dụng.
