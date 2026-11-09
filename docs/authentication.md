# Autentikasi dan otorisasi

## Akun Superuser pertama

Jalankan setelah migration diterapkan, menggunakan secret yang disediakan
melalui environment untuk proses CLI (jangan menaruhnya di source code atau
menampilkan nilainya di log):

Set `B2B_BOOTSTRAP_EMAIL` dan `B2B_BOOTSTRAP_PASSWORD` pada environment proses
dengan secret manager/provisioning yang sesuai (jangan menulis password pada
skrip atau command history). Password minimal 12 dan maksimal 128 karakter.
Lalu jalankan `npm run bootstrap:superuser` dan segera hapus variabel dari
environment proses/shell. CLI menolak apabila sudah ada akun ber-role
`SUPERUSER` atau marker `PRIMARY`. Unique marker database dan trigger tetap
menjadi pengaman terakhir terhadap bootstrap bersamaan. Tidak ada akun atau
password default.

Bootstrap menyiapkan role sistem `SUPERUSER`, `HELPDESK`, `SUPERVISOR` dan
permission administrasi pengguna. Permission `users.*` hanya diberikan ke
role SUPERUSER utama. Role HELPDESK/SUPERVISOR tidak mendapat permission
operasional secara default sampai matriks permission disetujui dan diberikan
secara terkontrol. Permission efektif adalah gabungan role permission dan
grant langsung aktif tanpa deny override.

## Sesi dan endpoint

Sesi memakai token acak dalam cookie `HttpOnly`, `SameSite=Lax`, path `/`,
berumur 8 jam, dengan `Secure` saat production. Database hanya menyimpan hash
SHA-256 token sesi. Logout, reset password, perubahan role, dan deaktivasi
menutup sesi terkait. Percobaan login dibatasi 10 kali per 15 menit per email
yang di-HMAC; successful login mereset penghitung. `AUTH_THROTTLE_SECRET`
disarankan di production; bila tidak diset, `DATABASE_URL` dipakai sebagai
kunci HMAC tanpa dicatat. `APP_ORIGIN` dapat ditetapkan ke origin publik yang
tepat; endpoint mutasi memeriksa header `Origin`.

- `POST /api/auth/login` — email/password; respons generik untuk kredensial
  tidak valid atau akun nonaktif.
- `POST /api/auth/logout` — mencabut sesi.
- `GET /api/auth/session` — mengembalikan identitas aman dan permission efektif.
- `GET/POST /api/users` — daftar akun yang dibuat actor / membuat akun.
- `PATCH /api/users/:id` — perbarui nama, status aktif, atau (Superuser utama
  saja) role HELPDESK/SUPERVISOR.
- `POST /api/users/:id/password` — set password baru dan cabut seluruh sesi
  target.
- `PUT /api/users/:id/permissions` — Superuser utama mengganti grant langsung
  akun target; grant/revoke dilakukan dalam transaksi, tanpa deny override.

Akun hanya dapat dikelola oleh pembuatnya. Tidak ada endpoint untuk membuat
Superuser kedua, mengubah akun sendiri, mengambil password lama, atau
memberikan permission lewat client yang tidak memiliki otorisasi server.
Semua respons akun menggunakan field allowlist dan tidak pernah menyertakan
password hash.

Sebelum dipakai production, tetapkan password policy perusahaan, perlindungan
rate limit tambahan berbasis jaringan pada reverse proxy, MFA/SSO, retensi
sesi, dan matriks permission HELPDESK/SUPERVISOR. Sistem menggunakan scrypt
bawaan Node dan tidak memerlukan dependency autentikasi tambahan.
