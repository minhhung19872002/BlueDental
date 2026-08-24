# CI/CD setup

Hai workflow trong `.github/workflows/`:

| File | Trigger | Lam gi |
|---|---|---|
| `ci.yml` | pull request, push (nhanh khac main) | Lint + typecheck + format + unit test + build cho FE; build + test cho BE; build thu 2 Docker image |
| `cd.yml` | push vao `main`, hoac chay tay | Chay lai toan bo CI, roi SSH vao VM deploy va smoke test |

`cd.yml` goi `ci.yml` qua `workflow_call`, nen **main chi deploy khi CI xanh**.

## 1. Tao SSH key rieng cho deploy

Chay **tren may ban** (khong phai tren VM), khong dat passphrase:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/bluedental_deploy -N ""
```

Cai public key len VM:

```bash
ssh-copy-id -i ~/.ssh/bluedental_deploy.pub hung@192.168.20.118
```

## 2. Mo SSH ra Internet

Deploy chay tu GitHub-hosted runner nen VM phai nhan duoc SSH tu ngoai.
Tren router: forward mot port public (vi du `2222`) -> `192.168.20.118:22`.

Toi thieu nen hardening `/etc/ssh/sshd_config` trên VM:

```
PasswordAuthentication no
PermitRootLogin no
KbdInteractiveAuthentication no
```

roi `sudo systemctl restart ssh`, va cai `fail2ban`.

> GitHub-hosted runner dung dai IP rat rong nen khong the whitelist IP chat che.
> Neu muon dong han port SSH, chuyen sang self-hosted runner (runner tu goi ra
> ngoai, khong can mo port nao) — luc do bo job `deploy` va thay bang
> `runs-on: self-hosted` chay thang `bash deploy.sh`.

## 3. Khai bao secrets / variables tren GitHub

`Settings -> Secrets and variables -> Actions`.

**Secrets** (tab *Secrets*):

| Ten | Gia tri |
|---|---|
| `SSH_HOST` | `14.225.83.93` (IP public cua VM) |
| `SSH_PORT` | Port da forward, vi du `2222`. Bo trong -> mac dinh `22` |
| `SSH_USER` | `hung` |
| `SSH_PRIVATE_KEY` | Toan bo noi dung `~/.ssh/bluedental_deploy` (ca dong `-----BEGIN...` va `-----END...`) |
| `SSH_KNOWN_HOSTS` | Ket qua cua lenh ben duoi |

Lay `SSH_KNOWN_HOSTS` (chay tu may ban, sau khi da forward port):

```bash
ssh-keyscan -p 2222 14.225.83.93
```

Dan **nguyen ca output**. Day la host key pinning — thieu no thi deploy se
phai tat `StrictHostKeyChecking`, tuc la chap nhan bat ky host key nao.

**Variables** (tab *Variables*, khong phai secret):

| Ten | Mac dinh neu bo trong |
|---|---|
| `DEPLOY_PATH` | `/home/hung/BlueDental` |
| `SITE_URL` | `https://bluedental.bluestar.com.vn` |

## 4. Quyen docker cho user deploy

`deploy.sh` goi `docker compose` khong qua sudo, nen user `hung` phai o trong
group `docker`:

```bash
sudo usermod -aG docker hung   # da co san tren VM nay
```

## 5. File `.env` tren VM

`cd.yml` chay `git reset --hard`, nhung `.env` nam trong `.gitignore` nen
**khong bi xoa**. Giu nguyen file `.env` hien tai tren VM — doi password trong
do se lam api khong connect duoc vao volume postgres da init san.

## Deploy tay / hotfix

- Chay lai deploy tu commit moi nhat: tab **Actions -> CD -> Run workflow**.
- Bo qua CI (chi dung khi hotfix gap): tick `skip_ci`.
- Deploy truc tiep tren VM: `bash deploy.sh`.

## Rollback

`cd.yml` in ra SHA dang chay truoc khi reset. De quay lai:

```bash
cd /home/hung/BlueDental
git reset --hard <SHA_CU>
bash deploy.sh
```

## Ghi chu ve buoc `format:check`

`npm run format:check` **khong** nam trong CI. Ly do: 123/193 file trong
`BlueDental.FE/src` chua tung chay qua prettier, nen bat buoc kiem tra format se
lam CI do vinh vien. Neu muon bat len sau nay:

```bash
cd BlueDental.FE && npm run format     # 1 commit reformat toan bo
```

roi them lai buoc nay vao `ci.yml` (job `frontend`, sau buoc `Lint`):

```yaml
      - name: Format check
        run: npm run format:check
```
