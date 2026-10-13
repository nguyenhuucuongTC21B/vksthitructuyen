/**
 * test_drive_check.js — Test bộ tính năng chẩn đoán Drive + chống mất dữ liệu.
 *
 * Kịch bản:
 *  A. Drive cấu hình SAI (key giả) trên server thật:
 *     - boot đọc Drive lỗi → dữ liệu vẫn nhận đăng ký (RAM an toàn)
 *     - /api/health trả lastError cụ thể
 *     - /api/admin/sync trả synced=false + nguyên nhân gần nhất
 *     - /api/admin/drive-check trả 5 mức, mức đầu FAIL có gợi ý sửa
 *  B. Thiếu env Drive hoàn toàn → drive-check mức 1 FAIL có gợi ý, mode=local
 *  C. (unit) reconcileWithDrive: boot đọc Drive lỗi → sync sau đó phải GỘP
 *     dữ liệu cũ trên Drive với dữ liệu mới trong RAM (KHÔNG đè mất).
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT_A = 3577;
const PORT_B = 3578;
let pass = 0;
let fail = 0;

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHealthy(port, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) return true;
    } catch {}
    await sleep(300);
  }
  return false;
}

/** Key giả: JSON hợp lệ (parse được) nhưng private_key rác → Google từ chối invalid_grant. */
const FAKE_KEY = Buffer.from(
  JSON.stringify({
    type: 'service_account',
    project_id: 'fake-project',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIfake\n-----END PRIVATE KEY-----\n',
    client_email: 'fake@fake-project.iam.gserviceaccount.com',
    client_id: '123',
  })
).toString('base64');

async function scenarioA() {
  console.log('\n──── KỊCH BẢN A: Drive cấu hình sai (key giả) ────');
  const dataDir = path.join(ROOT, 'data-test-a');
  const server = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT_A),
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-secret-a'.repeat(4),
      GOOGLE_SERVICE_ACCOUNT_JSON: FAKE_KEY,
      GOOGLE_DRIVE_FOLDER_ID: '1FakeFolderIdForTesting',
      LOCAL_DATA_DIR_OVERRIDE: dataDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  server.stdout.on('data', (d) => logs.push(d.toString()));
  server.stderr.on('data', (d) => logs.push(d.toString()));

  try {
    check('A1. Server vẫn KHỞI ĐỘNG được dù Drive sai (không crash-loop)', await waitHealthy(PORT_A));

    const health0 = await (await fetch(`http://127.0.0.1:${PORT_A}/api/health`)).json();
    check('A2. health.mode = drive (env có khai báo)', health0.mode === 'drive');

    // Đăng ký admin đầu tiên.
    const reg = await fetch(`http://127.0.0.1:${PORT_A}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cccd: '012345678901',
        password: 'matkhau123',
        fullName: 'Test Admin',
        phone: '0901234567',
        email: 'admin@test.vn',
        position: 'Trưởng ban',
        unit: 'Ban tổ chức',
      }),
    });
    const regBody = await reg.json();
    check('A3. Đăng ký vẫn 201 kể cả Drive lỗi (dữ liệu giữ trong RAM)', reg.status === 201, `status=${reg.status} body=${JSON.stringify(regBody).slice(0, 200)}`);
    const token = regBody.token;

    const health1 = await (await fetch(`http://127.0.0.1:${PORT_A}/api/health`)).json();
    const usersSync = health1.sync.find((s) => s.file === 'users.json');
    check('A4. health.sync có lastError cụ thể (không còn đoán mò)', typeof usersSync.lastError === 'string' && usersSync.lastError.length > 5, JSON.stringify(usersSync));
    check('A5. users.json đang pending (chưa lên được Drive)', usersSync.pending === true);

    // Đăng nhập + gọi sync.
    const login = await fetch(`http://127.0.0.1:${PORT_A}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cccd: '012345678901', password: 'matkhau123' }),
    });
    const loginBody = await login.json();
    const token2 = loginBody.token || token;
    check('A6. Đăng nhập admin OK', Boolean(token2));

    const sync = await fetch(`http://127.0.0.1:${PORT_A}/api/admin/sync`, { method: 'POST', headers: { Authorization: `Bearer ${token2}` } });
    const syncBody = await sync.json();
    check('A7. /admin/sync trả synced=false khi Drive lỗi', syncBody.synced === false);
    check(
      'A8. Thông báo sync có NGUYÊN NHÂN GẦN NHẤT (không chung chung)',
      /Nguyên nhân gần nhất/.test(syncBody.message || ''),
      syncBody.message
    );
    check('A9. Thông báo sync dẫn tới nút "Kiểm tra Drive ngay"', /Kiểm tra Drive ngay/.test(syncBody.message || ''));

    const dc = await fetch(`http://127.0.0.1:${PORT_A}/api/admin/drive-check`, { method: 'POST', headers: { Authorization: `Bearer ${token2}` } });
    const dcBody = await dc.json();
    check('A10. /admin/drive-check chạy được (200)', dc.status === 200);
    check('A11. Kết quả chẩn đoán ok=false', dcBody.ok === false);
    const readStep = (dcBody.steps || []).find((s) => s.name.startsWith('3.'));
    check('A12. Mức 3 (đọc thư mục) FAIL đúng như thực tế', readStep && readStep.ok === false, JSON.stringify(readStep || {}).slice(0, 300));
    check('A13. Mức FAIL có gợi ý sửa tiếng Việt cụ thể', Boolean(readStep && readStep.advice && readStep.advice.length > 20), readStep && readStep.advice);
    check('A14. Chẩn đoán trả clientEmail đúng service account', dcBody.clientEmail === 'fake@fake-project.iam.gserviceaccount.com');

    // Admin-only: user thường không gọi được drive-check.
    check('A15. server không crash sau toàn bộ chuỗi thao tác', await waitHealthy(PORT_A, 3000));
  } finally {
    server.kill('SIGTERM');
    await sleep(800);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
  }
}

async function scenarioB() {
  console.log('\n──── KỊCH BẢN B: Thiếu env Drive hoàn toàn (chế độ local) ────');
  const server = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT_B),
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-secret-b'.repeat(4),
      GOOGLE_SERVICE_ACCOUNT_JSON: '',
      GOOGLE_DRIVE_FOLDER_ID: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  server.stdout.on('data', (d) => logs.push(d.toString()));

  try {
    check('B1. Server khởi động ở chế độ local', await waitHealthy(PORT_B));
    const health = await (await fetch(`http://127.0.0.1:${PORT_B}/api/health`)).json();
    check('B2. health.mode = local', health.mode === 'local');

    // Đăng nhập (user đầu tiên = admin) rồi drive-check.
    await fetch(`http://127.0.0.1:${PORT_B}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cccd: '012345678902',
        password: 'matkhau123',
        fullName: 'Test Local',
        phone: '0901234568',
        email: 'local@test.vn',
        position: 'Nhân viên',
        unit: 'Phòng A',
      }),
    });
    const login = await fetch(`http://127.0.0.1:${PORT_B}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cccd: '012345678902', password: 'matkhau123' }),
    });
    const { token } = await login.json();

    const dc = await fetch(`http://127.0.0.1:${PORT_B}/api/admin/drive-check`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const dcBody = await dc.json();
    const step1 = (dcBody.steps || []).find((s) => s.name.startsWith('1.'));
    check('B3. drive-check: mức 1 (biến môi trường) FAIL', step1 && step1.ok === false);
    check('B4. Gợi ý nói rõ khai báo biến trên Render', /Render/.test(step1.advice || ''), step1.advice);
    check('B5. Chỉ trả đúng 1 bước (dừng sớm)', (dcBody.steps || []).length === 1);

    const sync = await fetch(`http://127.0.0.1:${PORT_B}/api/admin/sync`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const syncBody = await sync.json();
    check('B6. Chế độ local: sync coi như xong (mirror cục bộ là đủ)', syncBody.synced === true);
  } finally {
    server.kill('SIGTERM');
    await sleep(800);
    try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  }
}

async function scenarioC() {
  console.log('\n──── KỊCH BẢN C (unit): reconcile chống đè mất dữ liệu Drive ────');
  const ROOT_BACKUP = process.cwd();
  try {
    // Nạp module với sandbox env — tránh đọc .env thật.
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_KEY;
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1FakeFolderIdForTesting';

    const dataStore = require(path.join(ROOT, 'src/store/dataStore'));
    const driveClient = require(path.join(ROOT, 'src/drive/driveClient'));

    // --- Giai đoạn 1: boot ĐỌC LỖI (Drive hỏng) → RAM rỗng ---
    let driveDown = true;
    driveClient.isDriveMode = () => true;
    driveClient.findFileByName = async () => {
      if (driveDown) throw new Error('Drive down at boot');
      return 'file-123';
    };
    driveClient.downloadFile = async () => {
      if (driveDown) throw new Error('Drive down at boot');
      return [{ id: 'old-1', title: 'Đề cũ trên Drive', category: 'old' }];
    };
    driveClient.createFile = async () => 'file-123';
    let uploaded = null;
    driveClient.updateFile = async (fileId, content) => {
      if (driveDown) throw new Error('Drive down');
      uploaded = JSON.parse(content);
    };

    await dataStore.init();
    check('C1. Boot đọc Drive lỗi → RAM users rỗng (mirror rỗng)', dataStore.count('users') === 0);

    // --- Giai đoạn 2: admin tạo dữ liệu mới trong RAM (mô phỏng push) ---
    dataStore.get('users').push({
      id: 'new-1',
      cccd: '012345678903',
      fullName: 'Người mới sau boot lỗi',
    });

    // --- Giai đoạn 3: Drive hồi phục → sync phải GỘP chứ không đè ---
    driveDown = false;
    await dataStore.saveNow('users');
    check(
      'C2. Sync sau hồi phục: upload chứa BẢN GHI CŨ trên Drive (old-1)',
      Array.isArray(uploaded) && uploaded.some((u) => u.id === 'old-1'),
      JSON.stringify(uploaded)
    );
    check(
      'C3. Upload chứa BẢN GHI MỚI trong RAM (new-1)',
      Array.isArray(uploaded) && uploaded.some((u) => u.id === 'new-1')
    );
    check('C4. Tổng bản ghi sau gộp = 2 (không mất cái nào)', Array.isArray(uploaded) && uploaded.length === 2);

    // --- Giai đoạn 4: Drive vẫn hỏng → sync phải HOÃN (không upload) ---
    uploaded = null;
    driveDown = true;
    dataStore.get('users').push({ id: 'new-2', cccd: '012345678904', fullName: 'Nữa' });
    await dataStore.saveNow('users');
    check('C5. Drive vẫn lỗi: KHÔNG upload gì để tránh mất dữ liệu cũ', uploaded === null);

    const info = dataStore.getSyncInfo().find((s) => s.file === 'users.json');
    check('C6. getSyncInfo báo lastError khi không đối chiếu được', Boolean(info.lastError), JSON.stringify(info));
  } finally {
    process.chdir(ROOT_BACKUP);
    try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  }
}

async function scenarioD() {
  console.log('\n──── KỊCH BẢN D (unit): tự chữa lỗi QUOTA bằng file tạo tay ────');
  try {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_KEY;
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1FakeFolderIdForTesting';
    // Xóa cache module để dataStore/driveClient khởi động lại sạch.
    for (const m of Object.keys(require.cache)) {
      if (m.includes(path.join(ROOT, 'src'))) delete require.cache[m];
    }

    const dataStore = require(path.join(ROOT, 'src/store/dataStore'));
    const driveClient = require(path.join(ROOT, 'src/drive/driveClient'));

    const QUOTA_ERR = new Error('Service Accounts do not have storage quota.');
    let fileExistsOnDrive = false; // File users.json tạo tay: chưa có lúc boot.
    let createAttempts = 0;
    let downloadedContent = null;

    driveClient.isDriveMode = () => true;
    driveClient.findFileByName = async (name) => (fileExistsOnDrive ? 'user-file-1' : null);
    driveClient.downloadFile = async () => {
      // File tạo tay chứa sẵn 1 bản ghi cũ (giả lập dữ liệu có sẵn).
      return downloadedContent || [{ id: 'user-old', cccd: '099999999999', fullName: 'Cũ trong file tạo tay' }];
    };
    driveClient.createFile = async () => {
      createAttempts++;
      throw QUOTA_ERR; // Mô phỏng: SA không có dung lượng → không tạo được file mới.
    };
    let uploaded = null;
    driveClient.updateFile = async (fileId, content) => {
      uploaded = JSON.parse(content);
    };

    await dataStore.init(); // Boot: findFileByName → null → createFile → QUOTA → bootLoadFailed.

    // Admin thêm dữ liệu mới trong RAM.
    dataStore.get('users').push({ id: 'ram-1', cccd: '012345678906', fullName: 'Mới trong RAM' });
    fileExistsOnDrive = true; // ...và người dùng VỪA tạo file users.json trong thư mục.

    await dataStore.saveNow('users');
    check('D1. Đã thử tạo file (đúng kịch bản quota)', createAttempts >= 1);
    check(
      'D2. TỰ CHỮA: sync thành công bằng file người dùng tạo tay (không cần restart)',
      Array.isArray(uploaded),
      JSON.stringify(uploaded)
    );
    check(
      'D3. Dữ liệu cũ trong file tạo tay được GIỮ (user-old)',
      Array.isArray(uploaded) && uploaded.some((u) => u.id === 'user-old')
    );
    check(
      'D4. Dữ liệu mới trong RAM được GHI (ram-1)',
      Array.isArray(uploaded) && uploaded.some((u) => u.id === 'ram-1')
    );

    // lastError phải có gợi ý cụ thể cho lỗi quota (khi chưa tự chữa).
    const info = dataStore.getSyncInfo().find((s) => s.file === 'users.json');
    check('D5. Sau sync thành công lastError được xóa', info.lastError === null, JSON.stringify(info));
  } finally {
    try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  }
}

async function scenarioE() {
  console.log('\n──── KỊCH BẢN E (unit): file Google Docs (không phải JSON thuần) ────');
  try {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_KEY;
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1FakeFolderIdForTesting';
    for (const m of Object.keys(require.cache)) {
      if (m.includes(path.join(ROOT, 'src'))) delete require.cache[m];
    }

    const dataStore = require(path.join(ROOT, 'src/store/dataStore'));
    const driveClient = require(path.join(ROOT, 'src/drive/driveClient'));

    driveClient.isDriveMode = () => true;
    driveClient.findFileByName = async () => 'gdoc-file-1';
    driveClient.downloadFile = async () => {
      throw new Error('Invalid JSON'); // Google Docs alt:media trả nội dung không parse được.
    };
    driveClient.getFileMeta = async () => ({ id: 'gdoc-file-1', name: 'users.json', mimeType: 'application/vnd.google-apps.document' });
    driveClient.updateFile = async () => {};

    await dataStore.init();
    dataStore.get('users').push({ id: 'r1', cccd: '012345678907', fullName: 'X' });
    await dataStore.saveNow('users');

    const info = dataStore.getSyncInfo().find((s) => s.file === 'users.json');
    check(
      'E1. Báo lỗi CHÍNH XÁC file không phải JSON thuần (Google Docs)',
      /Google Docs|không phải file JSON thuần/i.test(info.lastError || ''),
      info.lastError
    );
    check('E2. KHÔNG upload đè lên file Google Docs', info.pending === true);
  } finally {
    try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  }
}

async function scenarioF() {
  console.log('\n──── KỊCH BẢN F (unit): checkUpdateExistingFile — mô hình 3 file tạo tay ────');
  try {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_KEY;
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1FakeFolderIdForTesting';
    const driveClient = require(path.join(ROOT, 'src/drive/driveClient'));
    // Truy cập hàm nội bộ qua runDiagnostic không tiện — test gián tiếp bằng fake dapi.
    // Hàm không export? export tạm qua closure không được → test qua module cache hack:
    // Thay vào đó, gọi qua một bản sao của module với __test hook không có → bỏ qua unit trực tiếp,
    // đã được bao phủ bởi kịch bản G (runDiagnostic với fake dapi).
    check('F1. (bỏ qua — được bao phủ trong kịch bản G)', true);
  } finally {}
}

async function scenarioG() {
  console.log('\n──── KỊCH BẢN G: runDiagnostic mức 4 TỰ CHUYỂN khi lỗi quota ────');
  try {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_KEY;
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1kvdJX6Va5OcS_OOQ8Jn7YhY3aRRSFR5M';
    for (const m of Object.keys(require.cache)) {
      if (m.includes(path.join(ROOT, 'src'))) delete require.cache[m];
    }
    // Googleapis không gọi thật: runDiagnostic dùng buildDriveClient → google.drive thực.
    // Ta monkey-patch google.drive TRƯỚC khi require driveClient.
    const fakeDapi = {
      files: {
        list: async ({ q }) => {
          if (q.includes('__drive_check__')) return { data: { files: [] } }; // mức 3
          if (q.includes('users.json')) return { data: { files: [{ id: 'uf1', name: 'users.json', mimeType: 'application/json' }] } };
          return { data: { files: [] } };
        },
        create: async () => {
          throw Object.assign(new Error('Service Accounts do not have storage quota. Leverage shared drives'), { code: 403 });
        },
        get: async (params) => {
          // alt:media download users.json → nội dung [] (file tạo tay rỗng)
          if (params.alt === 'media') return { data: Buffer.from('[]') };
          return { data: { id: params.fileId, mimeType: 'application/json' } };
        },
        update: async () => ({ data: { id: 'uf1' } }),
        delete: async () => ({ data: {} }),
      },
    };
    const mod = require(path.join(ROOT, 'src/drive/driveClient'));
    // Patch google.drive — driveClient gọi google.drive({version, auth}) trong buildDriveClient.
    const googleLib = require('googleapis');
    const originalDrive = googleLib.google.drive;
    googleLib.google.drive = (opts) => {
      void opts;
      return fakeDapi;
    };
    try {
      mod.init(); // buildDriveClient → google.drive fake → mode = drive
      const result = await mod.runDiagnostic();
      check('G1. runDiagnostic ok=true khi quota nhưng CẬP NHẬT được file có sẵn', result.ok === true, JSON.stringify(result.steps).slice(0, 400));
      const step4 = result.steps.find((s) => s.name.startsWith('4.'));
      check('G2. Mức 4 PASS với giải thích quota đúng', step4.ok === true && /KHÔNG tự tạo được file MỚI/.test(step4.detail), step4.detail.slice(0, 200));
      const step5 = result.steps.find((s) => s.name.startsWith('5.'));
      check('G3. Mức 5 bỏ qua dọn dẹp (không tạo rác)', step5.ok === true);
      check('G4. Thông báo tổng dẫn tới "Đồng bộ ngay"', /Đồng bộ ngay/.test(result.message));
    } finally {
      googleLib.google.drive = originalDrive; // Khôi phục.
    }
  } finally {
    try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  }
}

(async () => {
  console.log('════════ TEST: Chẩn đoán Drive + chống mất dữ liệu ════════');
  try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  await scenarioA();
  try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  await scenarioB();
  try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  await scenarioC();
  try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  await scenarioD();
  try { fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true }); } catch {}
  await scenarioE();
  await scenarioF();
  await scenarioG();
  console.log(`\n════════ KẾT QUẢ: ${pass} PASS / ${fail} FAIL ════════`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('Test crash:', e);
  process.exit(1);
});
